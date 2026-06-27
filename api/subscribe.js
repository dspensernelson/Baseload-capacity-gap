// Newsletter signup endpoint — POST /api/subscribe { email, source? }.
// Inserts into public.subscribers using the anon key. RLS allows insert-only
// (no read), so the list is never exposed. Duplicate emails are ignored, not
// errored, so re-signups are idempotent and never leak who is already on the list.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const body = readBody(req)
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254)
  const source = body.source ? String(body.source).slice(0, 60) : 'web'

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' })
    return
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/subscribers?on_conflict=email`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        // Idempotent: a repeat signup is a no-op, never a 409.
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ email, source }),
    })
    if (!r.ok && r.status !== 409) {
      const text = await r.text()
      throw new Error(`Supabase insert failed: ${r.status} ${text.slice(0, 200)}`)
    }
    res.status(200).json({ ok: true, message: "You're on the list. Look out for the weekly newswire." })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
