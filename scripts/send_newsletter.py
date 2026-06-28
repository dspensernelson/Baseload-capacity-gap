"""
Send the latest weekly news digest to active subscribers via Resend.

Reads the most recent `reports` row (kind='weekly_news') and the active
`subscribers` list, renders the markdown body to simple HTML, and sends one
email per subscriber through the Resend API.

Designed to be safe in CI before the list/keys exist:
  - No RESEND_API_KEY        -> logs a skipped sync_log row and exits 0.
  - No active subscribers    -> logs a skipped sync_log row and exits 0.
  - Issue already sent       -> skips (idempotent across manual re-runs).

Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
Optional env: RESEND_API_KEY, NEWSLETTER_FROM.

Run:
  python scripts/send_newsletter.py
"""

from __future__ import annotations

import os
import time

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
NEWSLETTER_FROM = os.getenv("NEWSLETTER_FROM", "Baseload — The Capacity Gap <newswire@nuclearpipeline.org>").strip()


def write_sync_log(sb, status, rows_inserted, start_t, errors, notes):
    try:
        sb.table("sync_log").insert({
            "source": "send_newsletter",
            "status": status,
            "rows_inserted": rows_inserted,
            "duration_ms": int((time.time() - start_t) * 1000),
            "error_message": ("; ".join(errors))[:500] if errors else None,
            "notes": notes,
        }).execute()
    except Exception as e:
        print(f"(could not write sync_log row: {e})")


def markdown_to_html(body: str) -> str:
    lines = []
    in_list = False
    for raw in body.splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<h2 style='font-size:18px;margin:22px 0 8px;color:#1b3a2b'>{line[3:].strip()}</h2>")
        elif line.startswith("- "):
            if not in_list:
                lines.append("<ul style='margin:0;padding-left:18px'>")
                in_list = True
            lines.append(f"<li style='margin:4px 0'>{line[2:].strip()}</li>")
        elif not line:
            if in_list:
                lines.append("</ul>")
                in_list = False
        else:
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<p style='margin:10px 0'>{line}</p>")
    if in_list:
        lines.append("</ul>")
    return "\n".join(lines)


def already_sent(sb, period: str) -> bool:
    try:
        resp = (
            sb.table("sync_log")
            .select("id,notes")
            .eq("source", "send_newsletter")
            .eq("status", "success")
            .order("id", desc=True)
            .limit(50)
            .execute()
        )
        for row in resp.data or []:
            if period and period in (row.get("notes") or ""):
                return True
    except Exception:
        pass
    return False


def send_email(to_email: str, subject: str, html: str, text: str) -> tuple[bool, str]:
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": NEWSLETTER_FROM, "to": [to_email], "subject": subject, "html": html, "text": text},
            timeout=20,
        )
        if r.status_code in (200, 201):
            return True, ""
        return False, f"{r.status_code}: {r.text[:160]}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main():
    start_t = time.time()
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    errors: list[str] = []

    digest_resp = (
        sb.table("reports")
        .select("period,title,body")
        .eq("kind", "weekly_news")
        .order("period", desc=True)
        .limit(1)
        .execute()
    )
    digest = (digest_resp.data or [None])[0]
    if not digest:
        write_sync_log(sb, "skipped", 0, start_t, [], "no weekly_news digest to send")
        print("No weekly digest found — nothing to send.")
        return

    period = digest.get("period", "")
    if not RESEND_API_KEY:
        write_sync_log(sb, "skipped", 0, start_t, [], f"no RESEND_API_KEY; digest {period} not sent")
        print("RESEND_API_KEY not set — skipping send (digest is published on the web/RSS).")
        return

    if already_sent(sb, period):
        write_sync_log(sb, "skipped", 0, start_t, [], f"digest {period} already sent")
        print(f"Digest {period} already sent — skipping.")
        return

    subs_resp = sb.table("subscribers").select("email").eq("status", "active").execute()
    subscribers = [row["email"] for row in (subs_resp.data or []) if row.get("email")]
    if not subscribers:
        write_sync_log(sb, "skipped", 0, start_t, [], f"no active subscribers; digest {period} not sent")
        print("No active subscribers — nothing to send.")
        return

    subject = digest.get("title", "Power Sector Newswire")
    body = digest.get("body", "")
    html = (
        "<div style='font-family:Georgia,serif;max-width:640px;margin:0 auto;color:#222;line-height:1.5'>"
        + markdown_to_html(body)
        + "<hr style='margin:24px 0;border:none;border-top:1px solid #ddd'>"
        + "<p style='font-size:12px;color:#888'>You are receiving this because you subscribed at Baseload — The Capacity Gap. "
        + "Reply to unsubscribe.</p></div>"
    )

    sent = 0
    for email in subscribers:
        ok, err = send_email(email, subject, html, body)
        if ok:
            sent += 1
        else:
            errors.append(f"{email}: {err}")

    status = "success" if sent and not errors else ("partial" if sent else "error")
    write_sync_log(sb, status, sent, start_t, errors[:5], f"digest {period}: sent {sent}/{len(subscribers)}")
    print(f"Sent digest {period} to {sent}/{len(subscribers)} subscribers.")


if __name__ == "__main__":
    main()
