const SITE = 'https://baseload-capacity-gap.vercel.app'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function fetchReports() {
  const url = `${SUPABASE_URL}/rest/v1/reports?select=title,body,period,published_at,stats&kind=eq.weekly_news&order=published_at.desc&limit=52`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

function buildRss(reports) {
  const items = reports.map(r => {
    const link = `${SITE}/dispatches`
    const lead = (r.body || '').split('\n')[0] || ''
    const stories = Array.isArray(r?.stats?.stories) ? r.stats.stories : []
    const bullets = stories.slice(0, 8)
      .map(s => `<li><a href="${escapeHtml(s.link)}">${escapeHtml(`[${s.source}] ${s.title}`)}</a></li>`)
      .join('')
    const html = `<p>${escapeHtml(lead)}</p>${bullets ? `<ul>${bullets}</ul>` : ''}`.replace(/]]>/g, ']] >')
    const guid = `${SITE}/newsletter/${r.period}`
    return `    <item>
      <title>${escapeHtml(r.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>
      <description><![CDATA[${html}]]></description>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Baseload — The Capacity Gap - Weekly Newswire</title>
    <link>${SITE}/dispatches</link>
    <atom:link href="${SITE}/newsletter.xml" rel="self" type="application/rss+xml" />
    <description>Weekly top nuclear news stories from free public feeds, auto-ranked and published.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`
}

export default async function handler(req, res) {
  try {
    const reports = await fetchReports()
    const xml = buildRss(reports)
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.status(200).send(xml)
  } catch (err) {
    res.status(502).send(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${escapeHtml(err.message)}</error>`)
  }
}
