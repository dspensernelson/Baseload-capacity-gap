import { useMemo } from 'react'

function fmtDate(iso) {
  if (!iso) return 'Unknown date'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return 'Unknown date'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function snippet(text) {
  const clean = String(text || '').trim()
  if (!clean) return 'No summary available from this source yet.'
  return clean.length > 260 ? `${clean.slice(0, 257)}...` : clean
}

export default function News({ reports = [], newsItems = [] }) {
  // The weekly digest provides an editorial lead; the rolling feed comes from
  // the durable news_items archive (refreshed daily).
  const digest = useMemo(
    () => reports.find(r => r.kind === 'weekly_news') ?? null,
    [reports],
  )

  // Prefer the live archive; fall back to the digest's embedded stories if the
  // archive has not been populated yet.
  const stories = useMemo(() => {
    if (Array.isArray(newsItems) && newsItems.length > 0) {
      // Cap per source so the chronological feed isn't flooded by one outlet
      // (e.g. the Google News aggregator), then re-sort newest-first.
      const MAX_PER_SOURCE = 6
      const perSource = {}
      const capped = []
      for (const n of newsItems) {
        const count = perSource[n.source] || 0
        if (count >= MAX_PER_SOURCE) continue
        perSource[n.source] = count + 1
        capped.push({
          source: n.source,
          title: n.title,
          link: n.url,
          summary: n.summary,
          published_at: n.published_at,
        })
      }
      capped.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      return capped
    }
    return Array.isArray(digest?.stats?.stories) ? digest.stats.stories : []
  }, [newsItems, digest])

  const sourceCounts = useMemo(() => {
    const counts = {}
    for (const s of stories) {
      counts[s.source] = (counts[s.source] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [stories])

  const hasContent = stories.length > 0

  return (
    <section style={{ maxWidth: '980px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">News</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '50rem', marginBottom: '1.25rem' }}>
        A rolling feed of headlines and summaries from across the power sector — nuclear,
        renewables, grid and markets — auto-ingested daily from public feeds and de-duplicated
        into a durable archive.
      </p>

      {!hasContent && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          The news archive is populating. Check back shortly.
        </p>
      )}

      {hasContent && (
        <>
          {digest && (
            <div style={{ marginBottom: '1rem', padding: '1rem 1.1rem', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>
                {digest.title} · published {fmtDate(digest.published_at)}
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{(digest.body || '').split('\n')[0]}</p>
            </div>
          )}

          {sourceCounts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1rem' }}>
              {sourceCounts.map(([source, count]) => (
                <span
                  key={source}
                  style={{ border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.73rem', color: 'var(--color-text-muted)', background: '#fff' }}
                >
                  {source} · {count}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {stories.map((s, i) => (
              <a
                key={`${s.link}-${i}`}
                href={s.link}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', padding: '0.75rem 0.8rem' }}
              >
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  {s.source} · {fmtDate(s.published_at)}
                </div>
                <div style={{ fontSize: '0.91rem', lineHeight: 1.42, color: 'var(--color-text)', marginBottom: '0.35rem' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--color-text-muted)' }}>
                  {snippet(s.summary)}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
