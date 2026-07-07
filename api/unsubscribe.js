// One-click unsubscribe — GET /api/unsubscribe?id=<subscriber uuid>.
// The uuid is only ever delivered inside that subscriber's own email, so
// possession of it is the authorization (standard unsubscribe-token pattern).
// Uses the anon key: RLS on public.subscribers only lets anon set
// status='unsubscribed' by id and read nothing (see supabase/subscribers.sql).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function page(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family:Georgia,serif;max-width:560px;margin:12vh auto;padding:0 1rem;color:#222;line-height:1.5">
<h1 style="font-size:1.3rem;color:#1b3a2b">${title}</h1>
<p>${message}</p>
<p><a href="/" style="color:#1b3a2b">← Back to the tracker</a></p>
</body></html>`
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim().toLowerCase()
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!UUID_RE.test(id)) {
    res.status(400).send(page('Invalid link', 'This unsubscribe link is malformed. If you pasted it, make sure you copied the whole URL.'))
    return
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/subscribers?id=eq.${id}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() }),
    })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Supabase update failed: ${r.status} ${text.slice(0, 200)}`)
    }
    // An unknown id also returns 204 (zero rows matched) — same message either
    // way, so the endpoint never confirms whether an id exists.
    res.status(200).send(page("You're unsubscribed", 'You will not receive the weekly newswire again. No confirmation email will be sent.'))
  } catch (err) {
    res.status(502).send(page('Something went wrong', 'We could not process the unsubscribe. Please try again in a minute, or reply to any newsletter email and we will remove you manually.'))
  }
}
