import { useState, useEffect, useMemo } from 'react'
import supabase from './supabase'
import HeadlineBand from './components/HeadlineBand'
import Hook from './components/Hook'
import GapChart from './components/GapChart'
import ReactorTable from './components/ReactorTable'

const ISO_LABELS = {
  PJM:  'PJM',
  MISO: 'MISO',
  ERCO: 'ERCOT',
  CISO: 'CAISO',
  NYIS: 'NYISO',
  ISNE: 'ISO-NE',
  SWPP: 'SPP',
  TVA:  'TVA',
  SOCO: 'SOCO',
  DUK:  'Duke',
  CPLE: 'Duke Progress',
  FPL:  'FPL',
  SRP:  'SRP',
  BPAT: 'BPA',
  SCEG: 'SCEG',
}

function ISOFilterBar({ reactors, selectedISO, setSelectedISO }) {
  const counts = {}
  reactors.forEach(r => { if (r.iso_rto) counts[r.iso_rto] = (counts[r.iso_rto] || 0) + 1 })

  const pills = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, label: ISO_LABELS[code] ?? code, count }))

  const btnBase = {
    padding: '0.3rem 0.75rem', borderRadius: '20px', border: '1.5px solid var(--color-border)',
    fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
    fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>Filter by ISO/RTO:</span>
      <button
        onClick={() => setSelectedISO(null)}
        style={{ ...btnBase, background: !selectedISO ? 'var(--color-brand)' : '#fff', color: !selectedISO ? '#fff' : 'var(--color-text)', borderColor: !selectedISO ? 'var(--color-brand)' : 'var(--color-border)' }}
      >
        All
      </button>
      {pills.map(({ code, label, count }) => (
        <button
          key={code}
          onClick={() => setSelectedISO(selectedISO === code ? null : code)}
          style={{ ...btnBase, background: selectedISO === code ? 'var(--color-brand)' : '#fff', color: selectedISO === code ? '#fff' : 'var(--color-text)', borderColor: selectedISO === code ? 'var(--color-brand)' : 'var(--color-border)' }}
        >
          {label} <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>{count}</span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [reactors, setReactors]   = useState([])
  const [headlines, setHeadlines] = useState(null)
  const [gapSeries, setGapSeries] = useState([])
  const [licenseActions, setLicenseActions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedISO, setSelectedISO] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: h }, { data: g }, { data: la }] = await Promise.all([
        supabase.from('reactors').select('*'),
        supabase.from('headline_numbers').select('*').single(),
        supabase.from('gap_series').select('*').order('year'),
        supabase.from('license_actions').select('*').order('action_date', { ascending: false }),
      ])
      setReactors(r ?? [])
      setHeadlines(h)
      setGapSeries(g ?? [])
      setLicenseActions(la ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const licenseActionsByReactor = useMemo(() => {
    const map = {}
    licenseActions.forEach(a => {
      if (!a.reactor_id) return
      ;(map[a.reactor_id] ??= []).push(a)
    })
    return map
  }, [licenseActions])

  const filteredReactors = useMemo(
    () => selectedISO ? reactors.filter(r => r.iso_rto === selectedISO) : reactors,
    [reactors, selectedISO]
  )

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

      {/* Hero: Gap Chart */}
      <section style={{ maxWidth: '1100px', marginTop: '3rem' }} className="centered">
        <h2 className="section-title">The Gap</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          US nuclear capacity from now to 2045 — retirements vs. new build.{' '}
          <a href="https://github.com/DSpEnder77/NukeMap/blob/main/docs/methodology.md"
             target="_blank" rel="noreferrer"
             style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}>
            How we calculated this
          </a>
        </p>
        <GapChart gapSeries={gapSeries} headlines={headlines} />
      </section>

      {/* Callouts: three headline numbers */}
      <div style={{ marginTop: '3rem' }}>
        <HeadlineBand headlines={headlines} />
      </div>

      {/* Map + Table side by side */}
      <section style={{ maxWidth: '1400px', marginTop: 'var(--spacing-section)', paddingBottom: '6rem' }} className="centered">
        <ISOFilterBar reactors={reactors} selectedISO={selectedISO} setSelectedISO={setSelectedISO} />
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 58%', minWidth: 0 }}>
            <Hook reactors={filteredReactors} setSelectedISO={setSelectedISO} licenseActionsByReactor={licenseActionsByReactor} />
          </div>
          <div style={{ flex: 1, minWidth: 0, height: '600px' }}>
            <ReactorTable reactors={filteredReactors} />
          </div>
        </div>
      </section>
    </>
  )
}
