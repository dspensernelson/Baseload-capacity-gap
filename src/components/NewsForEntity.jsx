import { useMemo } from 'react'
import { Link } from 'react-router-dom'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Reusable "In the news" rail. Surfaces archived news_items that mention any of
// the provided terms (plant name, operator, ISO, company). Used on reactor and
// grid pages to map the news archive onto the rest of the site.
export default function NewsForEntity({ newsItems = [], terms = [], limit = 5, title = 'In the news', emptyHint = null }) {
  const needles = useMemo(
    () => terms.filter(Boolean).map(t => String(t).toLowerCase()).filter(t => t.length >= 3),
    [terms],
  )

  const matches = useMemo(() => {
    if (!needles.length || !newsItems.length) return []
    const seen = new Set()
    const out = []
    for (const item of newsItems) {
      const hay = `${item.title ?? ''} ${item.summary ?? ''} ${(item.entities ?? []).join(' ')}`.toLowerCase()
      if (!needles.some(n => hay.includes(n))) continue
      const key = item.url ?? item.title
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    out.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    return out.slice(0, limit)
  }, [newsItems, needles, limit])

  if (!matches.length) {
    if (!emptyHint) return null
    return (
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--color-brand)', marginTop: '2rem', marginBottom: '0.6rem' }}>{title}</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2rem', marginBottom: '0.6rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--color-brand)', margin: 0 }}>{title}</h3>
        <Link to="/news" style={{ fontSize: '0.8rem', color: 'var(--color-brand)', textDecoration: 'none' }}>All news →</Link>
      </div>
      <div style={{ display: 'grid', gap: '0.7rem' }}>
        {matches.map(item => (
          <a
            key={item.url ?? item.title}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: '0.7rem 0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{item.source}</span>
              {item.category && item.category !== 'General' && <span>· {item.category}</span>}
              {item.published_at && <span>· {fmtDate(item.published_at)}</span>}
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 500, marginTop: '0.2rem', lineHeight: 1.35 }}>{item.title}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
