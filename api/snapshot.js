// Daily snapshot export — GET /api/snapshot (alias /snapshot.json).
// A single downloadable bundle of the public dataset: latest headline numbers,
// the most recent weekly digest, and the top recent news items. Served with a
// filename so it downloads cleanly. This is the portable, sellable data drop.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

async function rest(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed (${path}): ${res.status}`)
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    const [headline, digest, news] = await Promise.all([
      rest('headline_numbers?select=*&limit=1'),
      rest('reports?select=period,title,published_at,body,stats&kind=eq.weekly_news&order=period.desc&limit=1'),
      rest('news_items?select=source,title,url,published_at,score,category,entities&order=published_at.desc.nullslast&limit=100'),
    ])

    const today = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="nuclear-snapshot-${today}.json"`)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.status(200).json({
      generated_at: new Date().toISOString(),
      snapshot_date: today,
      headline: headline[0] || null,
      latest_digest: digest[0] || null,
      news_items: news,
      license: 'CC BY 4.0 — attribute Baseload — The Capacity Gap',
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
