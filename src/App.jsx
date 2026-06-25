import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import supabase from './supabase'
import Overview from './pages/Overview'
import MapPage from './pages/MapPage'
import Fleet from './pages/Fleet'
import Grid from './pages/Grid'
import Incidents from './pages/Incidents'
import Safety from './pages/Safety'
import History from './pages/History'
import Dispatches from './pages/Dispatches'
import Scenarios from './pages/Scenarios'
import Reactor from './pages/Reactor'
import DataExport from './pages/DataExport'
import EmbedGap from './pages/EmbedGap'
import Sources from './pages/Sources'

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
        Reactor power status refreshed daily from the U.S. NRC · last update {when}. License records refreshed weekly.
      </div>
      <div style={{ marginTop: '0.45rem', opacity: 0.85 }}>
        The data, charts, and the monthly dispatch update on their own. Sources: U.S. NRC &amp; U.S. EIA.
      </div>
      <div style={{ marginTop: '0.6rem' }}>
        <Link to="/data" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>The Data</Link>
        {' · '}
        <Link to="/sources" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>The Sources</Link>
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

// A grouped nav section: a label that reveals a small dropdown of routes, highlighted
// when any child route is active. Opens on hover, toggles on click (touch-friendly).
function NavSection({ label, items }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const active = items.some(it => pathname === it.to || pathname.startsWith(it.to + '/'))
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: '0.85rem', fontWeight: active ? 700 : 500, opacity: active ? 1 : 0.65,
        borderBottom: `2px solid ${active ? '#fff' : 'transparent'}`, paddingBottom: '2px',
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      }}>
        {label}<span style={{ fontSize: '0.6em', opacity: 0.8 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: '8px', zIndex: 100 }}>
          <div style={{
            background: 'var(--color-brand)', borderRadius: '8px', padding: '0.35rem', minWidth: '160px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.14)',
          }}>
            {items.map(it => (
              <NavLink key={it.to} to={it.to} onClick={() => setOpen(false)} style={({ isActive }) => ({
                display: 'block', padding: '0.45rem 0.65rem', borderRadius: '6px', whiteSpace: 'nowrap',
                color: '#fff', textDecoration: 'none', fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500, background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
                opacity: isActive ? 1 : 0.85,
              })}>{it.label}</NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [reactors, setReactors]   = useState([])
  const [headlines, setHeadlines] = useState(null)
  const [gapSeries, setGapSeries] = useState([])
  const [licenseActions, setLicenseActions] = useState([])
  const [fleetSeries, setFleetSeries] = useState([])
  const [demandSeries, setDemandSeries] = useState([])
  const [reports, setReports]     = useState([])
  const [projects, setProjects]   = useState([])
  const [loading, setLoading]     = useState(true)

  // ISO filter is URL-backed so /map?iso=PJM is a shareable, filtered view.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedISO = searchParams.get('iso')
  const setSelectedISO = iso => setSearchParams(prev => {
    const p = new URLSearchParams(prev)
    if (iso) p.set('iso', iso); else p.delete('iso')
    return p
  }, { replace: true })

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: h }, { data: g }, { data: la }, { data: fs }, { data: ds }, { data: rp }, { data: np }] = await Promise.all([
        supabase.from('reactors').select('*'),
        supabase.from('headline_numbers').select('*').single(),
        supabase.from('gap_series').select('*').order('year'),
        supabase.from('license_actions').select('*').order('action_date', { ascending: false }),
        supabase.from('fleet_output_series').select('*').order('report_date'),
        supabase.from('demand_growth_series').select('*').order('year'),
        supabase.from('reports').select('*').order('published_at', { ascending: false }),
        supabase.from('new_reactor_projects').select('*'),
      ])
      setReactors(r ?? [])
      setHeadlines(h)
      setGapSeries(g ?? [])
      setLicenseActions(la ?? [])
      setFleetSeries(fs ?? [])
      setDemandSeries(ds ?? [])
      setReports(rp ?? [])
      setProjects(np ?? [])
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

  const location = useLocation()
  useEffect(() => {
    if (location.pathname.startsWith('/reactor/')) return  // the reactor page sets its own title
    if (location.pathname.startsWith('/dispatches')) return  // the dispatches page sets its own title
    const titles = { '/': 'Overview', '/history': 'History', '/map': 'Map', '/fleet': 'The Fleet', '/grid': 'The Grid', '/incidents': 'Incidents', '/safety': 'Safety', '/dispatches': 'Dispatches', '/scenarios': 'Scenarios', '/sources': 'The Sources', '/data': 'The Data' }
    const t = titles[location.pathname]
    document.title = t ? `${t} · Nuclear Pipeline Tracker` : 'Nuclear Pipeline Tracker'
  }, [location.pathname])

  const isEmbed = location.pathname.startsWith('/embed')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
        Loading reactor data…
      </div>
    )
  }

  return (
    <>
      {!isEmbed && (<header style={{ background: 'var(--color-brand)', color: '#fff', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Nuclear Pipeline Tracker
        </Link>
        <nav style={{ display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/" end style={navLinkStyle}>Overview</NavLink>
          <NavLink to="/history" style={navLinkStyle}>History</NavLink>
          <NavSection label="The Fleet" items={[{ to: '/map', label: 'Map' }, { to: '/fleet', label: 'Performance' }, { to: '/incidents', label: 'Incidents' }]} />
          <NavSection label="The Case" items={[{ to: '/safety', label: 'Safety' }, { to: '/grid', label: 'The Grid' }, { to: '/scenarios', label: 'Scenarios' }]} />
          <NavLink to="/dispatches" style={navLinkStyle}>Dispatches</NavLink>
        </nav>
        <FleetPulse reactors={reactors} />
      </header>)}

      <Routes>
        <Route path="/" element={<Overview gapSeries={gapSeries} headlines={headlines} demandSeries={demandSeries} />} />
        <Route path="/history" element={<History />} />
        <Route
          path="/map"
          element={
            <MapPage
              reactors={reactors}
              filteredReactors={filteredReactors}
              projects={projects}
              licenseActionsByReactor={licenseActionsByReactor}
              selectedISO={selectedISO}
              setSelectedISO={setSelectedISO}
            />
          }
        />
        <Route path="/fleet" element={<Fleet fleetSeries={fleetSeries} reactors={reactors} />} />
        <Route path="/grid" element={<Grid reactors={reactors} />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/dispatches" element={<Dispatches reports={reports} licenseActions={licenseActions} reactors={reactors} />} />
        <Route path="/dispatches/:period" element={<Dispatches reports={reports} licenseActions={licenseActions} reactors={reactors} />} />
        <Route path="/scenarios" element={<Scenarios reactors={reactors} />} />
        <Route path="/reactor/:slug" element={<Reactor reactors={reactors} licenseActionsByReactor={licenseActionsByReactor} />} />
        <Route path="/data" element={<DataExport />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/embed/gap" element={<EmbedGap gapSeries={gapSeries} headlines={headlines} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isEmbed && <SiteFooter reactors={reactors} />}
    </>
  )
}
