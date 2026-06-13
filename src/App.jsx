import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, NavLink, Link, Navigate } from 'react-router-dom'
import supabase from './supabase'
import Overview from './pages/Overview'
import MapPage from './pages/MapPage'
import Fleet from './pages/Fleet'
import Grid from './pages/Grid'
import Dispatches from './pages/Dispatches'
import Scenarios from './pages/Scenarios'
import Reactor from './pages/Reactor'

// Fleet-wide "running right now" pulse, computed from the latest daily readings.
function FleetPulse({ reactors }) {
  let onlineMW = 0, capMW = 0, running = 0, total = 0
  reactors.forEach(r => {
    if (r.status !== 'operating' && r.status !== 'license_renewed') return
    const cap = parseFloat(r.capacity_mw)
    if (isNaN(cap)) return
    capMW += cap
    total += 1
    const pct = parseInt(r.daily_status, 10)
    if (!isNaN(pct)) {
      onlineMW += cap * pct / 100
      if (pct > 0) running += 1
    }
  })
  if (!capMW) return null
  const pctOfFleet = Math.round((onlineMW / capMW) * 100)
  const onlineGW   = (onlineMW / 1000).toFixed(0)

  return (
    <div
      title="Capacity-weighted output from the latest NRC daily power report"
      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
    >
      <span className="pulse-dot" />
      <span style={{ opacity: 0.9 }}>
        <strong style={{ fontWeight: 700 }}>{pctOfFleet}%</strong> of the fleet ·{' '}
        <strong style={{ fontWeight: 700 }}>~{onlineGW} GW</strong> online now
        <span style={{ opacity: 0.6 }}> · {running}/{total} units running</span>
      </span>
    </div>
  )
}

function SiteFooter({ reactors }) {
  const latest = reactors.reduce((max, r) => {
    const t = r.daily_status_updated_at ? new Date(r.daily_status_updated_at).getTime() : 0
    return t > max ? t : max
  }, 0)
  const when = latest
    ? new Date(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
  return (
    <footer style={{ borderTop: '1px solid var(--color-border)', padding: '2rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <span className="pulse-dot" style={{ width: 7, height: 7 }} />
        Reactor power status refreshed daily from the U.S. NRC · last update {when}. License records refreshed monthly.
      </div>
      <div style={{ marginTop: '0.45rem', opacity: 0.85 }}>
        The data, charts, and the monthly dispatch update on their own. Sources: U.S. NRC &amp; U.S. EIA.
      </div>
    </footer>
  )
}

const navLinkStyle = ({ isActive }) => ({
  color: '#fff',
  textDecoration: 'none',
  fontSize: '0.85rem',
  fontWeight: isActive ? 700 : 500,
  opacity: isActive ? 1 : 0.65,
  borderBottom: `2px solid ${isActive ? '#fff' : 'transparent'}`,
  paddingBottom: '2px',
})

export default function App() {
  const [reactors, setReactors]   = useState([])
  const [headlines, setHeadlines] = useState(null)
  const [gapSeries, setGapSeries] = useState([])
  const [licenseActions, setLicenseActions] = useState([])
  const [fleetSeries, setFleetSeries] = useState([])
  const [reports, setReports]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedISO, setSelectedISO] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: h }, { data: g }, { data: la }, { data: fs }, { data: rp }] = await Promise.all([
        supabase.from('reactors').select('*'),
        supabase.from('headline_numbers').select('*').single(),
        supabase.from('gap_series').select('*').order('year'),
        supabase.from('license_actions').select('*').order('action_date', { ascending: false }),
        supabase.from('fleet_output_series').select('*').order('report_date'),
        supabase.from('reports').select('*').order('published_at', { ascending: false }),
      ])
      setReactors(r ?? [])
      setHeadlines(h)
      setGapSeries(g ?? [])
      setLicenseActions(la ?? [])
      setFleetSeries(fs ?? [])
      setReports(rp ?? [])
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
      <header style={{ background: 'var(--color-brand)', color: '#fff', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Nuclear Pipeline Tracker
        </Link>
        <nav style={{ display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/" end style={navLinkStyle}>Overview</NavLink>
          <NavLink to="/map" style={navLinkStyle}>Map</NavLink>
          <NavLink to="/fleet" style={navLinkStyle}>The Fleet</NavLink>
          <NavLink to="/grid" style={navLinkStyle}>The Grid</NavLink>
          <NavLink to="/dispatches" style={navLinkStyle}>Dispatches</NavLink>
          <NavLink to="/scenarios" style={navLinkStyle}>Scenarios</NavLink>
        </nav>
        <FleetPulse reactors={reactors} />
      </header>

      <Routes>
        <Route path="/" element={<Overview gapSeries={gapSeries} headlines={headlines} />} />
        <Route
          path="/map"
          element={
            <MapPage
              reactors={reactors}
              filteredReactors={filteredReactors}
              licenseActionsByReactor={licenseActionsByReactor}
              selectedISO={selectedISO}
              setSelectedISO={setSelectedISO}
            />
          }
        />
        <Route path="/fleet" element={<Fleet fleetSeries={fleetSeries} reactors={reactors} />} />
        <Route path="/grid" element={<Grid />} />
        <Route path="/dispatches" element={<Dispatches reports={reports} />} />
        <Route path="/scenarios" element={<Scenarios reactors={reactors} />} />
        <Route path="/reactor/:slug" element={<Reactor reactors={reactors} licenseActionsByReactor={licenseActionsByReactor} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SiteFooter reactors={reactors} />
    </>
  )
}
