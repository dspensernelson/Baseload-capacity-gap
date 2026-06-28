// Public API catalog — GET /api (alias /api.json). A self-documenting index of
// the open data endpoints so integrators (and future paid tiers) can discover
// what's available without reading the source.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const base = `https://${req.headers.host || 'nuclearpipeline.org'}`
  res.status(200).json({
    name: 'Baseload — The Capacity Gap — Open Data API',
    description: 'Read-only JSON feeds over the power-sector news archive and grid dataset.',
    license: 'CC BY 4.0 — attribute Baseload — The Capacity Gap',
    endpoints: [
      {
        path: '/news.json',
        method: 'GET',
        description: 'Recent news items from the durable archive.',
        params: {
          limit: '1–200 (default 50)',
          offset: '>=0 for pagination (default 0)',
          source: 'exact source name',
          category: 'exact category (Nuclear, Solar, Wind, Grid & Markets, …)',
          since: 'ISO timestamp; only items at/after',
          q: 'case-insensitive title substring',
        },
        example: `${base}/news.json?category=Nuclear&limit=20`,
      },
      {
        path: '/trends.json',
        method: 'GET',
        description: 'Most-mentioned entities and category volumes over a window.',
        params: { days: '1–90 (default 7)' },
        example: `${base}/trends.json?days=7`,
      },
      {
        path: '/snapshot.json',
        method: 'GET',
        description: 'Downloadable bundle: headline numbers, latest digest, top 100 news items.',
        params: {},
        example: `${base}/snapshot.json`,
      },
      {
        path: '/newsletter.xml',
        method: 'GET',
        description: 'RSS feed of the weekly newswire digests.',
        params: {},
        example: `${base}/newsletter.xml`,
      },
      {
        path: '/rss.xml',
        method: 'GET',
        description: 'RSS feed of the monthly dispatch reports.',
        params: {},
        example: `${base}/rss.xml`,
      },
      {
        path: '/api/subscribe',
        method: 'POST',
        description: 'Join the weekly newswire. Body: { "email": "you@example.com" }.',
        params: {},
        example: `${base}/api/subscribe`,
      },
    ],
  })
}
