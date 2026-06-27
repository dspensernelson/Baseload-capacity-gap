"""
Shared feed configuration + parsing/scoring helpers for the news pipeline.

Two scripts build on this module:
  - news_ingest.py      (daily)  fetches every feed and upserts into news_items.
  - generate_newsletter.py (weekly) reads news_items and publishes a digest.

Keeping the feed list, normalization, dedup and scoring in one place means the
daily archive and the weekly digest can never drift apart.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

import requests

# Stories newer than this window are eligible for the weekly digest.
WINDOW_DAYS = 10

# Maximum stories per source in a single digest so no outlet dominates.
MAX_PER_SOURCE = 3

# Number of stories in the weekly digest.
TOP_STORIES = 18

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
    items: list[dict] = []
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


def fetch_all(warnings: list[str]) -> list[dict]:
    """Fetch and parse every configured feed into a flat list of item dicts."""
    raw: list[dict] = []
    for source, url in FEEDS:
        raw.extend(parse_feed(source, url, warnings))
    return raw


def normalize_title(title: str) -> str:
    t = clean(title).lower()
    t = re.sub(r"[^a-z0-9 ]+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def score_story(source: str, title: str, published_at: datetime | None, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    score = SOURCE_WEIGHT.get(source, 1)
    lowered = (title or "").lower()
    for kw, boost in KEYWORD_BOOST.items():
        if kw in lowered:
            score += boost

    if published_at:
        age_h = (now - published_at).total_seconds() / 3600
        if age_h <= 24:
            score += 4
        elif age_h <= 72:
            score += 2
        elif age_h <= 7 * 24:
            score += 1

    if len(title or "") >= 35:
        score += 1
    return score


def select_top(stories: list[Story], top_n: int = TOP_STORIES, max_per_source: int = MAX_PER_SOURCE) -> list[Story]:
    """Sort by score+recency, apply a per-source cap, then fill remaining slots."""
    ordered = sorted(stories, key=lambda s: (s.score, s.published_at), reverse=True)
    top: list[Story] = []
    per_source: dict[str, int] = {}
    leftovers: list[Story] = []
    for s in ordered:
        if len(top) >= top_n:
            break
        if per_source.get(s.source, 0) < max_per_source:
            top.append(s)
            per_source[s.source] = per_source.get(s.source, 0) + 1
        else:
            leftovers.append(s)
    for s in leftovers:
        if len(top) >= top_n:
            break
        top.append(s)
    top.sort(key=lambda s: (s.score, s.published_at), reverse=True)
    return top
