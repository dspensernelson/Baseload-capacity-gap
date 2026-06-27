// JSON API over the durable news_items archive — the seed of the data layer.
// Served at /api/news (and the friendly alias /news.json). Read-only, public,
// CDN-cached. Generated at request time from Supabase via the anon key (RLS
// allows public read), so there is nothing to regenerate or commit.
//
// Query params:
//   limit   1–200   (default 50)
//   offset  >=0       (default 0; for pagination)
//   source  exact source name filter (e.g. "Canary Media")
//   category exact category filter (e.g. "Nuclear")
//   since   ISO timestamp; only items published at/after this
//   q       case-insensitive substring match on the title
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const SELECT = 'source,title,url,summary,published_at,score,category,topics,entities,image_url,featured'

function clampLimit(raw) {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return 50
  return Math.min(Math.max(n, 1), 200)
}

function clampOffset(raw) {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 100000)
}

function isIsoLike(s) {
  // Accept date or date-time; reject anything else before it touches the query.
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)
}

async function fetchItems({ limit, offset, source, category, since, q }) {
  const params = new URLSearchParams()
  params.set('select', SELECT)
  params.set('order', 'published_at.desc.nullslast')
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (source) params.append('source', `eq.${source}`)
  if (category) params.append('category', `eq.${category}`)
  if (since) params.append('published_at', `gte.${since}`)
  if (q) params.append('title', `ilike.*${q}*`)

  const url = `${SUPABASE_URL}/rest/v1/news_items?${params.toString()}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { limit: rawLimit, source, category, since, q } = req.query || {}
    const limit = clampLimit(rawLimit)
    const offset = clampOffset((req.query || {}).offset)
    const cleanSince = since && isIsoLike(String(since)) ? String(since) : undefined
    const cleanSource = source ? String(source).slice(0, 120) : undefined
    const cleanCategory = category ? String(category).slice(0, 60) : undefined
    const cleanQ = q ? String(q).replace(/[%*,()]/g, ' ').trim().slice(0, 120) : undefined

    const items = await fetchItems({ limit, offset, source: cleanSource, category: cleanCategory, since: cleanSince, q: cleanQ })

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')
    res.status(200).json({
      generated_at: new Date().toISOString(),
      count: items.length,
      query: { limit, offset, source: cleanSource || null, category: cleanCategory || null, since: cleanSince || null, q: cleanQ || null },
      items,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
