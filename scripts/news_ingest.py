"""
Daily news ingest — fetch every configured feed and upsert into news_items.

This is the durable layer of the news pipeline. Each run:
  - pulls all feeds (tolerating partial failures),
  - filters to the recent window and de-duplicates by canonical URL,
  - upserts into news_items (url unique) so re-seen articles refresh last_seen
    rather than duplicating — the archive grows additively over time.

The weekly digest (generate_newsletter.py) reads from this table; it does not
fetch feeds directly anymore.

Run:
  python scripts/news_ingest.py
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

import news_feeds as nf

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

NOW = datetime.now(timezone.utc)


def write_sync_log(sb, status, rows_inserted, start_t, errors, notes):
    try:
        sb.table("sync_log").insert({
            "source": "news_ingest",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": notes,
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors: list[str] = []
    warnings: list[str] = []

    raw = nf.fetch_all(warnings)
    window_start = NOW - timedelta(days=nf.WINDOW_DAYS)

    # De-duplicate within this run by canonical URL, keeping the best-scored copy.
    by_url: dict[str, dict] = {}
    for item in raw:
        title = nf.clean(item.get("title", ""))
        url = nf.clean(item.get("link", ""))
        if not title or not url:
            continue

        published_at = item.get("published_at")
        if published_at is not None and published_at < window_start:
            continue

        source = item.get("source", "")
        summary = nf.clean(item.get("summary", ""))
        score = nf.score_story(source, title, published_at, NOW)
        category, topics = nf.classify(title, summary, source)
        entities = nf.extract_entities(title, summary)
        row = {
            "url": url,
            "source": source,
            "title": title,
            "summary": summary,
            "published_at": published_at.isoformat() if isinstance(published_at, datetime) else None,
            "score": score,
            "category": category,
            "topics": topics,
            "entities": entities,
            "image_url": item.get("image") or None,
            "featured": score >= 10,
            "last_seen": NOW.isoformat(),
        }
        prev = by_url.get(url)
        if prev is None or score > prev["score"]:
            by_url[url] = row

    rows = list(by_url.values())
    rows_inserted = 0
    if rows:
        try:
            # url-unique upsert: new articles insert (first_seen defaults to now),
            # re-seen articles refresh last_seen/score without duplicating.
            sb.table("news_items").upsert(rows, on_conflict="url").execute()
            rows_inserted = len(rows)
        except Exception as e:
            errors.append(f"upsert_error: {type(e).__name__}: {e}")
    else:
        errors.append("ingest_error: no items collected from any feed")

    status = "error" if errors else "success"
    notes = f"feeds={len(nf.FEEDS)} collected={len(raw)} upserted={rows_inserted}"
    if warnings:
        notes += " | warnings: " + "; ".join(warnings)
    write_sync_log(sb, status, rows_inserted, start_t, errors, notes[:1000])

    print(f"news_ingest: upserted {rows_inserted} items from {len(raw)} feed entries across {len(nf.FEEDS)} feeds")
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
