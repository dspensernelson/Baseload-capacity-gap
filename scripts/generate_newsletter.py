"""
Generate a weekly nuclear news digest from free public RSS/Atom feeds.

Writes one row into `reports` with kind='weekly_news' and logs a sync receipt.
If ANTHROPIC_API_KEY is configured, a short Claude summary is generated; otherwise
the summary is deterministic from the scored story list.

Run:
  python scripts/generate_newsletter.py
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

NOW = datetime.now(timezone.utc)
WINDOW_DAYS = 10

FEEDS = [
    # Nuclear-focused
    ("NRC News", "https://www.nrc.gov/reading-rm/doc-collections/news/news-release-rss.xml"),
    ("World Nuclear News", "https://www.world-nuclear-news.org/rss"),
    ("Nuclear Engineering International", "https://www.neimagazine.com/rss/"),
    # Broad power & energy
    ("EIA Today in Energy", "https://www.eia.gov/rss/todayinenergy.xml"),
    ("Utility Dive", "https://www.utilitydive.com/feeds/news/"),
    ("Canary Media", "https://www.canarymedia.com/rss"),
    ("POWER Magazine", "https://www.powermag.com/feed/"),
    ("RTO Insider", "https://www.rtoinsider.com/feed/"),
    ("Renewable Energy World", "https://www.renewableenergyworld.com/feed/"),
    ("PV Magazine", "https://www.pv-magazine.com/feed/"),
    ("Windpower Monthly", "https://www.windpowermonthly.com/rss"),
    ("Hydro Review", "https://www.hydroreview.com/feed/"),
    ("Energy Monitor", "https://www.energymonitor.ai/feed"),
    ("FT Energy Source", "https://www.ft.com/energy?format=rss"),
    # Aggregated catch-all
    (
        "Google News: power mix",
        "https://news.google.com/rss/search?q=%28nuclear+OR+solar+OR+wind+OR+gas+OR+coal+OR+power+grid%29+when%3A7d&hl=en-US&gl=US&ceid=US:en",
    ),
]

SOURCE_WEIGHT = {
    # Nuclear-focused
    "NRC News": 7,
    "World Nuclear News": 5,
    "Nuclear Engineering International": 4,
    # Broad power & energy
    "EIA Today in Energy": 6,
    "Utility Dive": 6,
    "Canary Media": 5,
    "POWER Magazine": 5,
    "RTO Insider": 5,
    "Renewable Energy World": 4,
    "PV Magazine": 4,
    "Windpower Monthly": 4,
    "Hydro Review": 4,
    "Energy Monitor": 4,
    "FT Energy Source": 5,
    # Aggregated catch-all
    "Google News: power mix": 2,
}

TOP_STORIES = 18

# Cap stories per source so no single outlet dominates the digest.
MAX_PER_SOURCE = 3

KEYWORD_BOOST = {
    "license": 3,
    "renewal": 3,
    "uprate": 3,
    "restart": 4,
    "reactor": 2,
    "nuclear": 2,
    "smr": 3,
    "small modular": 3,
    "construction": 2,
    "approval": 2,
    "safety": 2,
    "incident": 2,
    "grid": 1,
    "capacity": 1,
    "policy": 1,
}


@dataclass
class Story:
    source: str
    title: str
    link: str
    summary: str
    published_at: datetime
    score: int


def write_sync_log(sb, status, rows_inserted, start_t, errors, notes):
    try:
        sb.table("sync_log").insert({
            "source": "generate_newsletter",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": notes,
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def strip_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    return clean(s)


def normalize_link(link: str, feed_url: str) -> str:
    raw = clean(link)
    if not raw:
        return ""

    # Resolve feed-relative links and normalize accidental duplicated path slashes.
    absolute = urljoin(feed_url, raw)
    parts = urlsplit(absolute)
    path = re.sub(r"/{2,}", "/", parts.path or "")
    path = quote(path, safe="/%:@-._~!$&'()*+,;=")
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def text_of(node, names):
    for n in names:
        child = node.find(n)
        if child is not None and child.text:
            return clean(child.text)
    return ""


def _regex_parse_items(source: str, raw: str, base_url: str) -> list[dict]:
    """Fallback parser for feeds with malformed XML (e.g. mismatched tags).

    Extracts RSS <item> blocks with a tolerant regex so a single broken
    feed still contributes stories instead of being dropped entirely.
    """
    items = []

    def tag(block: str, name: str) -> str:
        m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", block, re.DOTALL | re.IGNORECASE)
        if not m:
            return ""
        val = m.group(1)
        cdata = re.match(r"\s*<!\[CDATA\[(.*?)\]\]>\s*$", val, re.DOTALL)
        return cdata.group(1) if cdata else val

    for m in re.finditer(r"<item[^>]*>(.*?)</item>", raw, re.DOTALL | re.IGNORECASE):
        block = m.group(1)
        title = clean(strip_html(tag(block, "title")))
        link = normalize_link(clean(strip_html(tag(block, "link"))), base_url)
        summary = strip_html(tag(block, "description"))
        published = parse_dt(tag(block, "pubDate") or tag(block, "date"))
        if title and link:
            items.append({"source": source, "title": title, "link": link, "summary": summary, "published_at": published})
    return items


def parse_feed(source: str, url: str, warnings: list[str]) -> list[dict]:
    items = []
    raw_content = None
    try:
        resp = requests.get(url, timeout=25, headers={"User-Agent": "NuclearPipelineTracker/1.0 (+news digest)"})
        resp.raise_for_status()
        raw_content = resp.content
        root = ET.fromstring(raw_content)
    except ET.ParseError as e:
        if raw_content is not None:
            recovered = _regex_parse_items(source, raw_content.decode("utf-8", "replace"), url)
            if recovered:
                return recovered
        warnings.append(f"feed_fetch_error[{source}]: {type(e).__name__}: {e}")
        return items
    except Exception as e:
        warnings.append(f"feed_fetch_error[{source}]: {type(e).__name__}: {e}")
        return items

    # RSS 2.0
    for item in root.findall("./channel/item"):
        title = text_of(item, ["title"])
        link = normalize_link(text_of(item, ["link"]), url)
        summary = strip_html(text_of(item, ["description"]))
        published = parse_dt(text_of(item, ["pubDate", "date"]))
        if title and link:
            items.append({"source": source, "title": title, "link": link, "summary": summary, "published_at": published})

    # Atom
    for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry"):
        title = text_of(entry, ["{http://www.w3.org/2005/Atom}title"])
        link_node = entry.find("{http://www.w3.org/2005/Atom}link")
        link = normalize_link(link_node.attrib.get("href", "") if link_node is not None else "", url)
        summary = strip_html(text_of(entry, ["{http://www.w3.org/2005/Atom}summary", "{http://www.w3.org/2005/Atom}content"]))
        published = parse_dt(text_of(entry, ["{http://www.w3.org/2005/Atom}published", "{http://www.w3.org/2005/Atom}updated"]))
        if title and link:
            items.append({"source": source, "title": title, "link": link, "summary": summary, "published_at": published})

    return items


def normalize_title(title: str) -> str:
    t = clean(title).lower()
    t = re.sub(r"[^a-z0-9 ]+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def score_story(source: str, title: str, published_at: datetime | None) -> int:
    score = SOURCE_WEIGHT.get(source, 1)
    lowered = title.lower()
    for kw, boost in KEYWORD_BOOST.items():
        if kw in lowered:
            score += boost

    if published_at:
        age_h = (NOW - published_at).total_seconds() / 3600
        if age_h <= 24:
            score += 4
        elif age_h <= 72:
            score += 2
        elif age_h <= 7 * 24:
            score += 1

    if len(title) >= 35:
        score += 1
    return score


def short_date(dt: datetime | None) -> str:
    if not dt:
        return "unknown"
    return dt.strftime("%b %d")


def deterministic_summary(stories: list[Story]) -> str:
    if not stories:
        return "No stories cleared the quality threshold this week."

    sources = {}
    for s in stories:
        sources[s.source] = sources.get(s.source, 0) + 1
    top_sources = ", ".join(f"{k} ({v})" for k, v in sorted(sources.items(), key=lambda kv: kv[1], reverse=True)[:3])

    return (
        f"This week pulled {len(stories)} high-signal nuclear stories from free public feeds. "
        f"Coverage was led by {top_sources}."
    )


def maybe_claude_summary(stories: list[Story], errors: list[str]) -> tuple[str, bool]:
    if not ANTHROPIC_API_KEY or not stories:
        return deterministic_summary(stories), False

    sample = [
        {
            "source": s.source,
            "title": s.title,
            "published": s.published_at.isoformat() if s.published_at else None,
            "url": s.link,
        }
        for s in stories[:12]
    ]

    prompt = (
        "Write a concise weekly nuclear-news lead in 2 sentences max. "
        "No hype, no speculation, no markdown bullets. Focus on what moved this week.\n\n"
        f"Stories JSON:\n{json.dumps(sample, ensure_ascii=True)}"
    )

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            timeout=35,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-5-haiku-latest",
                "max_tokens": 220,
                "temperature": 0.1,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        chunks = payload.get("content") or []
        text = " ".join(c.get("text", "") for c in chunks if c.get("type") == "text").strip()
        return (text or deterministic_summary(stories)), bool(text)
    except Exception as e:
        errors.append(f"claude_summary_error: {type(e).__name__}: {e}")
        return deterministic_summary(stories), False


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors: list[str] = []
    warnings: list[str] = []

    raw = []
    for source, url in FEEDS:
        raw.extend(parse_feed(source, url, warnings))

    window_start = NOW - timedelta(days=WINDOW_DAYS)
    dedup = {}
    for item in raw:
        title = clean(item.get("title", ""))
        link = clean(item.get("link", ""))
        if not title or not link:
            continue

        published_at = item.get("published_at")
        if published_at is not None and published_at < window_start:
            continue

        key = normalize_title(title)
        if not key:
            continue

        cand = {
            "source": item.get("source", ""),
            "title": title,
            "link": link,
            "summary": clean(item.get("summary", "")),
            "published_at": published_at,
            "score": score_story(item.get("source", ""), title, published_at),
        }

        prev = dedup.get(key)
        if prev is None or cand["score"] > prev["score"]:
            dedup[key] = cand

    stories = [
        Story(
            source=v["source"],
            title=v["title"],
            link=v["link"],
            summary=v.get("summary", ""),
            published_at=v["published_at"] if isinstance(v["published_at"], datetime) else NOW,
            score=v["score"],
        )
        for v in dedup.values()
    ]
    stories.sort(key=lambda s: (s.score, s.published_at), reverse=True)

    # Apply a per-source cap first so no single outlet dominates, then fill
    # any remaining slots with the best leftover stories regardless of source.
    top = []
    per_source = {}
    leftovers = []
    for s in stories:
        if len(top) >= TOP_STORIES:
            break
        if per_source.get(s.source, 0) < MAX_PER_SOURCE:
            top.append(s)
            per_source[s.source] = per_source.get(s.source, 0) + 1
        else:
            leftovers.append(s)
    for s in leftovers:
        if len(top) >= TOP_STORIES:
            break
        top.append(s)
    top.sort(key=lambda s: (s.score, s.published_at), reverse=True)

    if not top:
        errors.append("story_selection_error: no stories selected from feeds")

    lead, claude_used = maybe_claude_summary(top, errors)

    iso_year, iso_week, _ = NOW.isocalendar()
    period = f"{iso_year}-W{iso_week:02d}"
    title = f"Nuclear Newswire - Week {iso_week}, {iso_year}"

    lines = [lead, "", "Top stories:"]
    for s in top:
        lines.append(f"- [{s.source}] {s.title} ({short_date(s.published_at)})")
    body = "\n".join(lines)

    stats = {
        "story_count": len(top),
        "feed_count": len(FEEDS),
        "claude_used": claude_used,
        "stories": [
            {
                "source": s.source,
                "title": s.title,
                "link": s.link,
                "summary": s.summary,
                "published_at": s.published_at.isoformat() if s.published_at else None,
                "score": s.score,
            }
            for s in top
        ],
    }

    rows_inserted = 0
    try:
        sb.table("reports").upsert(
            {
                "kind": "weekly_news",
                "period": period,
                "title": title,
                "body": body,
                "stats": stats,
                "published_at": NOW.isoformat(),
            },
            on_conflict="kind,period",
        ).execute()
        rows_inserted = 1
    except Exception as e:
        errors.append(f"upsert_error: {type(e).__name__}: {e}")

    status = "error" if errors else "success"
    write_sync_log(
        sb,
        status,
        rows_inserted,
        start_t,
        errors + warnings,
        notes=f"weekly_news period={period}; stories={len(top)}; claude_used={claude_used}; warnings={len(warnings)}",
    )

    print(f"Published weekly news digest: {title}")
    print(f"Stories selected: {len(top)} from {len(raw)} feed items")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print("Warnings/errors:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)



if __name__ == "__main__":
    main()
