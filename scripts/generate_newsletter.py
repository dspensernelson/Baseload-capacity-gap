"""
Generate the weekly news digest from the news_items archive.

Reads the recent window of stories collected by scripts/news_ingest.py, scores
and caps them per source, and writes one row into `reports` (kind='weekly_news').
If ANTHROPIC_API_KEY is configured a short Claude lead is generated; otherwise the
lead is deterministic. As a first-run safety net (empty archive), it can fall back
to fetching feeds live via the shared news_feeds module.

Run:
  python scripts/generate_newsletter.py
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

import news_feeds as nf
from news_feeds import Story

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

NOW = datetime.now(timezone.utc)


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


def short_date(dt: datetime | None) -> str:
    if not dt:
        return "unknown"
    return dt.strftime("%b %d")


def parse_iso(value) -> datetime | None:
    if not value:
        return None
    try:
        s = str(value)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def load_recent_stories(sb, warnings: list[str]) -> list[Story]:
    """Read the recent window from news_items; fall back to live feeds if empty."""
    window_start = NOW - timedelta(days=nf.WINDOW_DAYS)
    rows = []
    try:
        resp = (
            sb.table("news_items")
            .select("source,title,url,summary,published_at,score,category,entities,image_url")
            .gte("published_at", window_start.isoformat())
            .order("score", desc=True)
            .limit(400)
            .execute()
        )
        rows = resp.data or []
    except Exception as e:
        warnings.append(f"news_items_read_error: {type(e).__name__}: {e}")

    if rows:
        stories = []
        for r in rows:
            published = parse_iso(r.get("published_at")) or NOW
            stories.append(
                Story(
                    source=r.get("source", ""),
                    title=r.get("title", ""),
                    link=r.get("url", ""),
                    summary=r.get("summary", "") or "",
                    published_at=published,
                    score=int(r.get("score") or nf.score_story(r.get("source", ""), r.get("title", ""), published, NOW)),
                    category=r.get("category") or "General",
                    entities=r.get("entities") or [],
                    image_url=r.get("image_url") or "",
                )
            )
        return stories

    # First-run safety net: archive empty, fetch feeds live this once.
    warnings.append("news_items_empty: falling back to live feed fetch")
    raw = nf.fetch_all(warnings)
    dedup: dict[str, dict] = {}
    for item in raw:
        title = nf.clean(item.get("title", ""))
        link = nf.clean(item.get("link", ""))
        if not title or not link:
            continue
        published = item.get("published_at")
        if published is not None and published < window_start:
            continue
        key = nf.normalize_title(title)
        if not key:
            continue
        category, _topics = nf.classify(title, nf.clean(item.get("summary", "")), item.get("source", ""))
        cand = {
            "source": item.get("source", ""),
            "title": title,
            "link": link,
            "summary": nf.clean(item.get("summary", "")),
            "published_at": published if isinstance(published, datetime) else NOW,
            "score": nf.score_story(item.get("source", ""), title, published, NOW),
            "category": category,
            "entities": nf.extract_entities(title, nf.clean(item.get("summary", ""))),
            "image_url": item.get("image") or "",
        }
        prev = dedup.get(key)
        if prev is None or cand["score"] > prev["score"]:
            dedup[key] = cand
    return [Story(**v) for v in dedup.values()]


def deterministic_summary(stories: list[Story]) -> str:
    if not stories:
        return "No stories cleared the quality threshold this week."

    sources = {}
    for s in stories:
        sources[s.source] = sources.get(s.source, 0) + 1
    top_sources = ", ".join(f"{k} ({v})" for k, v in sorted(sources.items(), key=lambda kv: kv[1], reverse=True)[:3])

    return (
        f"This week pulled {len(stories)} high-signal stories from across the power sector. "
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
        "Write a concise weekly power-sector news lead in 2 sentences max. "
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

    stories = load_recent_stories(sb, warnings)
    top = nf.select_top(stories, nf.TOP_STORIES, nf.MAX_PER_SOURCE)

    if not top:
        errors.append("story_selection_error: no stories selected from archive")

    lead, claude_used = maybe_claude_summary(top, errors)

    iso_year, iso_week, _ = NOW.isocalendar()
    period = f"{iso_year}-W{iso_week:02d}"
    title = f"Power Sector Newswire - Week {iso_week}, {iso_year}"

    # Group the selected stories into topic sections for a scannable digest.
    SECTION_ORDER = ["Nuclear", "Solar", "Wind", "Hydro", "Storage", "Gas & Coal", "Grid & Markets", "Policy", "General"]
    by_cat: dict[str, list] = {}
    for s in top:
        by_cat.setdefault(s.category or "General", []).append(s)
    ordered_sections = [c for c in SECTION_ORDER if c in by_cat] + [c for c in by_cat if c not in SECTION_ORDER]

    lines = [lead, ""]
    sections_stats = []
    for cat in ordered_sections:
        items = by_cat[cat]
        lines.append(f"## {cat}")
        for s in items:
            lines.append(f"- [{s.source}] {s.title} ({short_date(s.published_at)})")
        lines.append("")
        sections_stats.append({"category": cat, "count": len(items)})
    body = "\n".join(lines).strip()

    stats = {
        "story_count": len(top),
        "feed_count": len(nf.FEEDS),
        "claude_used": claude_used,
        "sections": sections_stats,
        "stories": [
            {
                "source": s.source,
                "title": s.title,
                "link": s.link,
                "summary": s.summary,
                "published_at": s.published_at.isoformat() if s.published_at else None,
                "score": s.score,
                "category": s.category,
                "entities": s.entities,
                "image_url": s.image_url,
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
    notes = f"stories={len(top)} from window={nf.WINDOW_DAYS}d"
    if warnings:
        notes += " | warnings: " + "; ".join(warnings)
    write_sync_log(sb, status, rows_inserted, start_t, errors, notes[:1000])

    print(f"Published weekly news digest: {title}")
    print(f"Stories selected: {len(top)} from {len(stories)} archive items")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
