// Trend rollup over the news archive — GET /api/trends (alias /trends.json).
// Aggregates the last N days of news_items into the most-mentioned entities
// (companies, ISOs/RTOs) and category volumes. Read-only, public, CDN-cached.
// This is the seed of a sellable "what's moving this week" signal feed.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

function clampDays(raw) {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return 7
  return Math.min(Math.max(n, 1), 90)
}

async function fetchSince(sinceIso) {
  const params = new URLSearchParams()
  params.set('select', 'category,entities,published_at')
  params.set('published_at', `gte.${sinceIso}`)
  params.set('order', 'published_at.desc')
  params.set('limit', '1000')
  const url = `${SUPABASE_URL}/rest/v1/news_items?${params.toString()}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

function tally(rows) {
  const entities = new Map()
  const categories = new Map()
  for (const row of rows) {
    const cat = row.category || 'General'
    categories.set(cat, (categories.get(cat) || 0) + 1)
    for (const e of row.entities || []) {
      if (!e) continue
      entities.set(e, (entities.get(e) || 0) + 1)
    }
  }
  const toSorted = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  return { entities: toSorted(entities), categories: toSorted(categories) }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    const days = clampDays((req.query || {}).days)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const rows = await fetchSince(since)
    const { entities, categories } = tally(rows)

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
    res.status(200).json({
      generated_at: new Date().toISOString(),
      window_days: days,
      story_count: rows.length,
      top_entities: entities.slice(0, 15),
      categories,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
