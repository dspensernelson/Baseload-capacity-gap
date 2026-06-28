// RSS 2.0 feed for the Dispatches archive. Generated at request time from the
// `reports` table — no static file to regenerate or commit, always current.
const SITE = 'https://baseload-capacity-gap.vercel.app'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Minimal converter matched to exactly what scripts/generate_dispatch.py emits:
// "## " headers, blank-line-separated paragraphs, **bold**, _italic_, and a lone "---" rule.
function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

function markdownToHtml(md) {
  return md.trim().split(/\n\s*\n/).map(block => {
    const t = block.trim()
    if (t === '---') return '<hr/>'
    if (t.startsWith('## ')) return `<h2>${inline(t.slice(3).trim())}</h2>`
    return `<p>${inline(t.replace(/\n/g, ' '))}</p>`
  }).join('\n')
}

async function fetchReports() {
  const url = `${SUPABASE_URL}/rest/v1/reports?select=title,body,period,published_at&kind=eq.monthly&order=published_at.desc&limit=50`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

function buildRss(reports) {
  const items = reports.map(r => {
    const link = `${SITE}/dispatches/${r.period}`
    const html = markdownToHtml(r.body).replace(/]]>/g, ']] >')
    return `    <item>
      <title>${escapeHtml(r.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>
      <description><![CDATA[${html}]]></description>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Baseload — The Capacity Gap — Dispatches</title>
    <link>${SITE}/dispatches</link>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>A plain-English monthly read on the U.S. nuclear fleet — what's running, what the NRC moved, where the gap stands.</description>
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
