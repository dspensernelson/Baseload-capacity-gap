import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import supabase from './supabase'

// Route-level code splitting keeps the initial bundle small; each page chunk
// loads on demand behind the Suspense fallback below.
const Overview = lazy(() => import('./pages/Overview'))
const MapPage = lazy(() => import('./pages/MapPage'))
const Fleet = lazy(() => import('./pages/Fleet'))
const Grid = lazy(() => import('./pages/Grid'))
const Prices = lazy(() => import('./pages/Prices'))
const Incidents = lazy(() => import('./pages/Incidents'))
const Safety = lazy(() => import('./pages/Safety'))
const History = lazy(() => import('./pages/History'))
const Dispatches = lazy(() => import('./pages/Dispatches'))
const News = lazy(() => import('./pages/News'))
const Newsletter = lazy(() => import('./pages/Newsletter'))
const Scenarios = lazy(() => import('./pages/Scenarios'))
const Reactor = lazy(() => import('./pages/Reactor'))
const DataExport = lazy(() => import('./pages/DataExport'))
const EmbedGap = lazy(() => import('./pages/EmbedGap'))
const Sources = lazy(() => import('./pages/Sources'))

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

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
      Loading…
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
  opacity: isActive ? 1 : 0.72,
  borderBottom: `2px solid ${isActive ? '#fff' : 'transparent'}`,
  paddingBottom: '2px',
})

export default function App() {
  const [reactors, setReactors]   = useState([])
  const [headlines, setHeadlines] = useState(null)
  const [gapSeries, setGapSeries] = useState([])
  const [licenseActions, setLicenseActions] = useState([])
  const [fleetSeries, setFleetSeries] = useState([])
  const [demandSeries, setDemandSeries] = useState([])
  const [reports, setReports]     = useState([])
  const [newsItems, setNewsItems] = useState([])
  const [projects, setProjects]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

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
      setLoadError('')
      setLoading(true)
      try {
        const names = [
          'reactors',
          'headline_numbers',
          'gap_series',
          'license_actions',
          'fleet_output_series',
          'demand_growth_series',
          'reports',
          'new_reactor_projects',
          'news_items',
        ]
        const results = await Promise.all([
          supabase.from('reactors').select('*'),
          supabase.from('headline_numbers').select('*').single(),
          supabase.from('gap_series').select('*').order('year'),
          supabase.from('license_actions').select('*').order('action_date', { ascending: false }),
          supabase.from('fleet_output_series').select('*').order('report_date'),
          supabase.from('demand_growth_series').select('*').order('year'),
          supabase.from('reports').select('*').order('published_at', { ascending: false }),
          supabase.from('new_reactor_projects').select('*'),
          supabase.from('news_items').select('*').order('published_at', { ascending: false }).limit(200),
        ])

        const queryErrors = results
          .map((res, idx) => (res.error ? `${names[idx]}: ${res.error.message}` : null))
          .filter(Boolean)

        if (queryErrors.length) {
          throw new Error(queryErrors.join(' | '))
        }

        const [{ data: r }, { data: h }, { data: g }, { data: la }, { data: fs }, { data: ds }, { data: rp }, { data: np }, { data: ni }] = results
        setReactors(r ?? [])
        setHeadlines(h)
        setGapSeries(g ?? [])
        setLicenseActions(la ?? [])
        setFleetSeries(fs ?? [])
        setDemandSeries(ds ?? [])
        setReports(rp ?? [])
        setProjects(np ?? [])
        setNewsItems(ni ?? [])
      } catch (e) {
        console.error('App bootstrap failed:', e)
        setLoadError('Live data could not be loaded right now. Please retry in a moment.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reloadTick])

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
    const titles = { '/': 'Overview', '/history': 'History', '/map': 'Map', '/fleet': 'The Fleet', '/grid': 'The Grid', '/prices': 'Wholesale Prices', '/incidents': 'Incidents', '/safety': 'Safety', '/dispatches': 'Dispatches', '/news': 'News', '/newsletter': 'Newswire', '/scenarios': 'Scenarios', '/sources': 'The Sources', '/data': 'The Data' }
    const t = titles[location.pathname]
    document.title = t ? `${t} · Baseload` : 'Baseload — The Capacity Gap'
  }, [location.pathname])

  const isEmbed = location.pathname.startsWith('/embed')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
        Loading reactor data…
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', background: 'var(--color-background)' }}>
        <div style={{ maxWidth: '38rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)', padding: '1.25rem 1.35rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-brand)', fontSize: '1.25rem' }}>Data temporarily unavailable</h2>
          <p style={{ marginTop: '0.7rem', marginBottom: '1rem', color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>{loadError}</p>
          <button
            onClick={() => setReloadTick(t => t + 1)}
            style={{ border: '1px solid var(--color-brand)', background: 'var(--color-brand)', color: '#fff', borderRadius: '7px', padding: '0.45rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {!isEmbed && (<header style={{ background: 'var(--color-brand)', color: '#fff', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Baseload
        </Link>
        <nav style={{ display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/" end style={navLinkStyle}>Overview</NavLink>
          <NavLink to="/history" style={navLinkStyle}>History</NavLink>
          <NavLink to="/map" style={navLinkStyle}>Map</NavLink>
          <NavLink to="/fleet" style={navLinkStyle}>Fleet</NavLink>
          <NavLink to="/incidents" style={navLinkStyle}>Incidents</NavLink>
          <NavLink to="/safety" style={navLinkStyle}>Safety</NavLink>
          <NavLink to="/grid" style={navLinkStyle}>Grid</NavLink>
          <NavLink to="/prices" style={navLinkStyle}>Prices</NavLink>
          <NavLink to="/scenarios" style={navLinkStyle}>Scenarios</NavLink>
          <NavLink to="/dispatches" style={navLinkStyle}>Dispatches</NavLink>
          <NavLink to="/news" style={navLinkStyle}>News</NavLink>
          <NavLink to="/newsletter" style={navLinkStyle}>Newswire</NavLink>
          <NavLink to="/data" style={navLinkStyle}>Data</NavLink>
          <NavLink to="/sources" style={navLinkStyle}>Sources</NavLink>
        </nav>
        <FleetPulse reactors={reactors} />
      </header>)}

      <Routes>
        <Route path="/" element={<Suspense fallback={<RouteFallback />}><Overview gapSeries={gapSeries} headlines={headlines} /></Suspense>} />
        <Route path="/history" element={<Suspense fallback={<RouteFallback />}><History /></Suspense>} />
        <Route
          path="/map"
          element={
            <Suspense fallback={<RouteFallback />}>
            <MapPage
              reactors={reactors}
              filteredReactors={filteredReactors}
              projects={projects}
              licenseActionsByReactor={licenseActionsByReactor}
              selectedISO={selectedISO}
              setSelectedISO={setSelectedISO}
            />
            </Suspense>
          }
        />
        <Route path="/fleet" element={<Suspense fallback={<RouteFallback />}><Fleet fleetSeries={fleetSeries} reactors={reactors} newsItems={newsItems} /></Suspense>} />
        <Route path="/grid" element={<Suspense fallback={<RouteFallback />}><Grid reactors={reactors} demandSeries={demandSeries} newsItems={newsItems} /></Suspense>} />
        <Route path="/prices" element={<Suspense fallback={<RouteFallback />}><Prices /></Suspense>} />
        <Route path="/incidents" element={<Suspense fallback={<RouteFallback />}><Incidents /></Suspense>} />
        <Route path="/safety" element={<Suspense fallback={<RouteFallback />}><Safety /></Suspense>} />
        <Route path="/dispatches" element={<Suspense fallback={<RouteFallback />}><Dispatches reports={reports} licenseActions={licenseActions} reactors={reactors} /></Suspense>} />
        <Route path="/dispatches/:period" element={<Suspense fallback={<RouteFallback />}><Dispatches reports={reports} licenseActions={licenseActions} reactors={reactors} /></Suspense>} />
        <Route path="/news" element={<Suspense fallback={<RouteFallback />}><News reports={reports} newsItems={newsItems} reactors={reactors} licenseActions={licenseActions} /></Suspense>} />
        <Route path="/newsletter" element={<Suspense fallback={<RouteFallback />}><Newsletter reports={reports} /></Suspense>} />
        <Route path="/newsletter/:period" element={<Suspense fallback={<RouteFallback />}><Newsletter reports={reports} /></Suspense>} />
        <Route path="/scenarios" element={<Suspense fallback={<RouteFallback />}><Scenarios reactors={reactors} /></Suspense>} />
        <Route path="/reactor/:slug" element={<Suspense fallback={<RouteFallback />}><Reactor reactors={reactors} licenseActionsByReactor={licenseActionsByReactor} newsItems={newsItems} /></Suspense>} />
        <Route path="/data" element={<Suspense fallback={<RouteFallback />}><DataExport /></Suspense>} />
        <Route path="/sources" element={<Suspense fallback={<RouteFallback />}><Sources /></Suspense>} />
        <Route path="/embed/gap" element={<Suspense fallback={<RouteFallback />}><EmbedGap gapSeries={gapSeries} headlines={headlines} /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isEmbed && <SiteFooter reactors={reactors} />}
    </>
  )
}
