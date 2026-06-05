import { useState, useEffect } from 'react'
import supabase from './supabase'
import HeadlineBand from './components/HeadlineBand'
import Hook from './components/Hook'
import GapChart from './components/GapChart'
import ReactorTable from './components/ReactorTable'

export default function App() {
  const [reactors, setReactors]   = useState([])
  const [headlines, setHeadlines] = useState(null)
  const [gapSeries, setGapSeries] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedISO, setSelectedISO] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: h }, { data: g }] = await Promise.all([
        supabase.from('reactors').select('*'),
        supabase.from('headline_numbers').select('*').single(),
        supabase.from('gap_series').select('*').order('year'),
      ])
      setReactors(r ?? [])
      setHeadlines(h)
      setGapSeries(g ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filteredReactors = selectedISO
    ? reactors.filter(r => r.iso_rto === selectedISO)
    : reactors

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
        Loading reactor data…
      </div>
    )
  }

  return (
    <>
      <header style={{ background: 'var(--color-brand)', color: '#fff', padding: '1rem 2rem', display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>Nuclear Pipeline Tracker</span>
        <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>The gap between what's retiring and what's coming online</span>
      </header>

      <HeadlineBand headlines={headlines} />

      <section style={{ maxWidth: 'var(--max-width-map)', marginTop: 'var(--spacing-section)' }} className="centered">
        {selectedISO && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Filtered: {selectedISO}</span>
            <button onClick={() => setSelectedISO(null)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'none', cursor: 'pointer' }}>
              Clear ×
            </button>
          </div>
        )}
        <Hook reactors={reactors} setSelectedISO={setSelectedISO} />
      </section>

      <section style={{ maxWidth: 'var(--max-width-chart)', marginTop: 'var(--spacing-section)' }} className="centered">
        <h2 className="section-title">The Gap</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          US nuclear capacity from now to 2045 — retirements vs. new build.
        </p>
        <GapChart gapSeries={gapSeries} headlines={headlines} />
      </section>

      <section style={{ maxWidth: 'var(--max-width-table)', marginTop: 'var(--spacing-section)', paddingBottom: '6rem' }} className="centered">
        <h2 className="section-title">Every Reactor</h2>
        <ReactorTable reactors={filteredReactors} />
      </section>
    </>
  )
}
