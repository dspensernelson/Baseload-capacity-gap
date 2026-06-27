import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const CATEGORY_ORDER = [
  'Nuclear', 'Solar', 'Wind', 'Hydro', 'Storage', 'Gas & Coal', 'Grid & Markets', 'Policy', 'General',
]

// Topic chips deep-link to the relevant data page so news is connective tissue.
const CATEGORY_LINK = {
  Nuclear: '/fleet',
  'Grid & Markets': '/grid',
  Policy: '/dispatches',
}

const MAX_PER_SOURCE = 6

function fmtDate(iso) {
  if (!iso) return 'Unknown date'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return 'Unknown date'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function snippet(text, n = 220) {
  const clean = String(text || '').trim()
  if (!clean) return 'No summary available from this source yet.'
  return clean.length > n ? `${clean.slice(0, n - 3)}...` : clean
}

function timeBucket(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Earlier'
  const days = (Date.now() - d.getTime()) / 86400000
  if (days < 1) return 'Today'
  if (days < 7) return 'This week'
  return 'Earlier'
}

const CARD = {
  textDecoration: 'none', color: 'inherit', border: '1px solid var(--color-border)',
  borderRadius: '8px', background: 'var(--color-surface)', padding: '0.75rem 0.8rem',
  display: 'block',
}
const META = {
  fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--color-text-muted)', marginBottom: '0.25rem',
}

export default function News({ reports = [], newsItems = [], reactors = [], licenseActions = [] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const topic = searchParams.get('topic') || 'All'
  const [query, setQuery] = useState('')

  const setTopic = t => setSearchParams(prev => {
    const p = new URLSearchParams(prev)
    if (t && t !== 'All') p.set('topic', t); else p.delete('topic')
    return p
  }, { replace: true })

  const digest = useMemo(
    () => reports.find(r => r.kind === 'weekly_news') ?? null,
    [reports],
  )

  // Plants with an NRC license action in the last 60 days → a "Regulatory event"
  // badge when a story mentions them. News + structured data reinforce each other.
  const hotPlants = useMemo(() => {
    const nameById = {}
    for (const r of reactors) nameById[r.id] = r.plant_name
    const cutoff = Date.now() - 60 * 86400000
    const names = new Set()
    for (const a of licenseActions) {
      const t = a.action_date ? new Date(a.action_date).getTime() : 0
      if (t >= cutoff) {
        const n = nameById[a.reactor_id]
        if (n && n.length > 4) names.add(n)
      }
    }
    return [...names]
  }, [reactors, licenseActions])

  const regulatoryMatch = story => {
    const hay = `${story.title} ${story.summary || ''}`.toLowerCase()
    return hotPlants.find(n => hay.includes(n.toLowerCase())) || null
  }

  // Normalize the archive (preferred) or fall back to the digest's stored stories.
  const allStories = useMemo(() => {
    const raw = (Array.isArray(newsItems) && newsItems.length > 0)
      ? newsItems.map(n => ({
          source: n.source, title: n.title, link: n.url, summary: n.summary,
          published_at: n.published_at, category: n.category || 'General',
          topics: n.topics || [], entities: n.entities || [], image_url: n.image_url,
          featured: !!n.featured, score: n.score || 0,
        }))
      : (Array.isArray(digest?.stats?.stories) ? digest.stats.stories.map(s => ({
          ...s, category: s.category || 'General', entities: s.entities || [], score: s.score || 0,
        })) : [])

    // Per-source cap so no single outlet floods the feed.
    const perSource = {}
    const capped = []
    for (const s of raw) {
      const c = perSource[s.source] || 0
      if (c >= MAX_PER_SOURCE) continue
      perSource[s.source] = c + 1
      capped.push(s)
    }
    return capped
  }, [newsItems, digest])

  const categoryCounts = useMemo(() => {
    const counts = {}
    for (const s of allStories) counts[s.category] = (counts[s.category] || 0) + 1
    return counts
  }, [allStories])

  const orderedCategories = useMemo(
    () => CATEGORY_ORDER.filter(c => categoryCounts[c]),
    [categoryCounts],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allStories.filter(s => {
      if (topic !== 'All' && s.category !== topic) return false
      if (q && !`${s.title} ${s.summary || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allStories, topic, query])

  // Trending entities across the current filter.
  const trending = useMemo(() => {
    const counts = {}
    for (const s of filtered) for (const e of (s.entities || [])) counts[e] = (counts[e] || 0) + 1
    return Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [filtered])

  // Hero = highest-scored featured story in the current filter (fallback: top score).
  const hero = useMemo(() => {
    if (filtered.length === 0) return null
    const byScore = [...filtered].sort((a, b) => (b.score || 0) - (a.score || 0))
    return byScore.find(s => s.featured) || byScore[0]
  }, [filtered])

  const rest = useMemo(
    () => filtered.filter(s => s !== hero).sort((a, b) => new Date(b.published_at) - new Date(a.published_at)),
    [filtered, hero],
  )

  const grouped = useMemo(() => {
    const buckets = { Today: [], 'This week': [], Earlier: [] }
    for (const s of rest) buckets[timeBucket(s.published_at)].push(s)
    return ['Today', 'This week', 'Earlier'].map(label => [label, buckets[label]]).filter(([, arr]) => arr.length)
  }, [rest])

  const hasContent = allStories.length > 0

  const Badge = ({ story }) => {
    const reg = regulatoryMatch(story)
    if (!reg) return null
    return (
      <span style={{ display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '0.08rem 0.35rem', marginLeft: '0.4rem' }}>
        ⚡ Regulatory event · {reg}
      </span>
    )
  }

  const StoryCard = ({ story }) => (
    <a href={story.link} target="_blank" rel="noreferrer" style={CARD}>
      <div style={META}>
        {story.source} · {fmtDate(story.published_at)}
        {story.category && story.category !== 'General' && (
          <span style={{ color: 'var(--color-accent, #2563eb)' }}> · {story.category}</span>
        )}
      </div>
      <div style={{ fontSize: '0.91rem', lineHeight: 1.42, color: 'var(--color-text)', marginBottom: '0.35rem' }}>
        {story.title}<Badge story={story} />
      </div>
      <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--color-text-muted)' }}>
        {snippet(story.summary)}
      </div>
    </a>
  )

  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">News</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '50rem', marginBottom: '1.1rem' }}>
        A rolling, categorized feed from across the power sector — nuclear, renewables, grid and
        markets — auto-ingested daily from public feeds into a durable archive.
      </p>

      {!hasContent && (
        <p style={{ color: 'var(--color-text-muted)' }}>The news archive is populating. Check back shortly.</p>
      )}

      {hasContent && (
        <>
          {/* Category tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
            {['All', ...orderedCategories].map(c => {
              const active = c === topic
              const count = c === 'All' ? allStories.length : categoryCounts[c]
              return (
                <button
                  key={c}
                  onClick={() => setTopic(c)}
                  style={{
                    cursor: 'pointer', borderRadius: '999px', padding: '0.25rem 0.7rem', fontSize: '0.78rem',
                    border: '1px solid var(--color-border)',
                    background: active ? 'var(--color-text)' : '#fff',
                    color: active ? '#fff' : 'var(--color-text)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {c} <span style={{ opacity: 0.6 }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Search + topic deep-link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search headlines…"
              style={{
                flex: '1 1 260px', maxWidth: '420px', padding: '0.45rem 0.7rem', fontSize: '0.85rem',
                border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff',
              }}
            />
            {topic !== 'All' && CATEGORY_LINK[topic] && (
              <a href={CATEGORY_LINK[topic]} style={{ fontSize: '0.8rem', color: 'var(--color-accent, #2563eb)' }}>
                See {topic} data →
              </a>
            )}
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{filtered.length} stories</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              {digest && topic === 'All' && !query && (
                <div style={{ marginBottom: '1rem', padding: '1rem 1.1rem', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div style={META}>{digest.title} · published {fmtDate(digest.published_at)}</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{(digest.body || '').split('\n')[0]}</p>
                </div>
              )}

              {/* Hero / featured story */}
              {hero && (
                <a href={hero.link} target="_blank" rel="noreferrer" style={{ ...CARD, padding: '0', overflow: 'hidden', marginBottom: '1.1rem', display: 'block' }}>
                  {hero.image_url && (
                    <img src={hero.image_url} alt="" loading="lazy" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: '0.9rem 1rem' }}>
                    <div style={META}>
                      ★ Featured · {hero.source} · {fmtDate(hero.published_at)}
                      {hero.category && hero.category !== 'General' && (
                        <span style={{ color: 'var(--color-accent, #2563eb)' }}> · {hero.category}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '1.15rem', lineHeight: 1.3, fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.4rem' }}>
                      {hero.title}<Badge story={hero} />
                    </div>
                    <div style={{ fontSize: '0.86rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                      {snippet(hero.summary, 320)}
                    </div>
                  </div>
                </a>
              )}

              {/* Time-grouped feed */}
              {grouped.map(([label, arr]) => (
                <div key={label} style={{ marginBottom: '1.4rem' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>{label}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {arr.map((s, i) => <StoryCard key={`${s.link}-${i}`} story={s} />)}
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)' }}>No stories match this filter.</p>
              )}
            </div>

            {/* Trending rail */}
            <aside style={{ position: 'sticky', top: '1rem' }}>
              {trending.length > 0 && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', padding: '0.9rem 1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>Trending</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {trending.map(([name, n]) => (
                      <button
                        key={name}
                        onClick={() => setQuery(name)}
                        style={{ cursor: 'pointer', textAlign: 'left', border: 'none', background: 'none', padding: 0, fontSize: '0.84rem', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Data also available as JSON at <a href="/news.json" style={{ color: 'var(--color-accent, #2563eb)' }}>/news.json</a>.
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
