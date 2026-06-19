import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../supabase'

// "History" — the story of nuclear power as a sourced vertical timeline, ending on the
// site's thesis (the gap). Reads history_milestones; every entry links its source.

const CAT = {
  discovery:  { color: '#1d3557', label: 'Discovery' },
  milestone:  { color: '#3a8a5f', label: 'Milestone' },
  accident:   { color: '#b04a32', label: 'Accident' },
  expansion:  { color: '#6b8cae', label: 'Growth' },
  retirement: { color: '#a23b2d', label: 'Retirement' },
  revival:    { color: '#2d6a4f', label: 'Revival' },
}
const catOf = c => CAT[c] || { color: 'var(--color-text-muted)', label: c }

export default function History() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    supabase.from('history_milestones').select('*').order('sort_order')
      .then(({ data }) => { if (alive) setItems(data ?? []) })
    return () => { alive = false }
  }, [])

  return (
    <section style={{ maxWidth: '820px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">History</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1.7, maxWidth: '46rem' }}>
        Nuclear power went from a chalkboard idea to a fifth of America's electricity in a single lifetime — then
        stopped building, started retiring, and is only now turning back. Here's the whole arc, and how it leads to
        the gap this site tracks.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', margin: '1.5rem 0 2rem' }}>
        {Object.values(CAT).map(c => (
          <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />{c.label}
          </span>
        ))}
      </div>

      <div style={{ position: 'relative', paddingLeft: '1.75rem' }}>
        <div style={{ position: 'absolute', left: '6px', top: '6px', bottom: '6px', width: '2px', background: 'var(--color-border)' }} />
        {items.map(m => {
          const c = catOf(m.category)
          return (
            <div key={m.slug} style={{ position: 'relative', marginBottom: '1.6rem' }}>
              <span style={{ position: 'absolute', left: 'calc(-1.75rem + 1px)', top: '5px', width: 13, height: 13, borderRadius: '50%', background: c.color, border: '2px solid #fff', boxShadow: '0 0 0 1px var(--color-border)' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 900, color: c.color, lineHeight: 1 }}>{m.year_label}</div>
              <div style={{ fontWeight: 700, fontSize: '1.02rem', marginTop: '0.25rem' }}>{m.title}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', lineHeight: 1.6 }}>{m.description}</div>
              {m.source && (
                <a href={m.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'var(--color-brand)', textDecoration: 'none' }}>{m.source} ↗</a>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '1rem', padding: '1.1rem 1.3rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)' }}>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.65 }}>
          That last line is the whole reason this site exists — watch it unfold on{' '}
          <Link to="/" style={{ color: 'var(--color-brand)' }}>the gap</Link>,{' '}
          <Link to="/incidents" style={{ color: 'var(--color-brand)' }}>Incidents</Link>, and{' '}
          <Link to="/scenarios" style={{ color: 'var(--color-brand)' }}>Scenarios</Link>.
        </p>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '1.5rem', lineHeight: 1.6 }}>
        Each entry links its source above; the full registry is on{' '}
        <Link to="/sources" style={{ color: 'var(--color-brand)' }}>The Sources</Link>, and the timeline is downloadable on{' '}
        <Link to="/data" style={{ color: 'var(--color-brand)' }}>The Data</Link>.
      </p>
    </section>
  )
}
