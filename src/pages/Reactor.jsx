import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reactorSlug } from '../lib/slug'
import { PowerSparkline, LicenseActionLine } from '../components/Hook'
import NewsForEntity from '../components/NewsForEntity'

const STATUS_COLORS = {
  operating:       '#2d6a4f',
  license_renewed: '#52b788',
  decommissioning: '#e76f51',
  shutdown:        '#6c757d',
}

function fmtYear(d) { return d ? new Date(d).getFullYear() : '—' }

function Fact({ label, value }) {
  return (
    <div style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  )
}

export default function Reactor({ reactors, licenseActionsByReactor, newsItems = [] }) {
  const { slug } = useParams()
  const reactor = reactors.find(r => reactorSlug(r) === slug)

  useEffect(() => {
    if (reactor) document.title = `${reactor.plant_name} ${reactor.unit_number} · Nuclear Pipeline Tracker`
  }, [reactor])

  if (!reactor) {
    return (
      <section style={{ maxWidth: '760px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
        <h2 className="section-title">Reactor not found</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          No reactor matches that link. <Link to="/" style={{ color: 'var(--color-brand)' }}>Back to the map →</Link>
        </p>
      </section>
    )
  }

  const actions = (licenseActionsByReactor[reactor.id] ?? [])
    .slice()
    .sort((a, b) => (b.action_date ?? '').localeCompare(a.action_date ?? ''))
  const statusColor = STATUS_COLORS[reactor.status] ?? '#6c757d'
  const pct = parseInt(reactor.daily_status, 10)
  const cap = parseFloat(reactor.capacity_mw)
  const offline = pct === 0
  const outputMW = !isNaN(pct) && !isNaN(cap) ? Math.round((pct / 100) * cap) : null

  return (
    <section style={{ maxWidth: '760px', marginTop: '2.5rem', paddingBottom: '4rem' }} className="centered">
      <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-brand)', textDecoration: 'none' }}>← Back to the map</Link>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 900, color: 'var(--color-brand)', lineHeight: 1.1 }}>
          {reactor.plant_name}
        </h1>
        <span style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>Unit {reactor.unit_number}</span>
      </div>

      <div style={{ display: 'inline-block', marginTop: '0.6rem', padding: '0.2rem 0.7rem', borderRadius: '12px', background: statusColor, color: '#fff', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {reactor.status?.replace('_', ' ')}
      </div>

      {reactor.daily_status && (
        <div style={{ marginTop: '1rem', fontSize: '0.95rem', color: offline ? 'var(--color-decommissioning)' : 'var(--color-operating)' }}>
          ● {offline
              ? 'Offline — 0% power (refueling or outage)'
              : <>{reactor.daily_status}{outputMW != null && <span style={{ color: 'var(--color-text-muted)' }}> · ~{outputMW.toLocaleString()} MW generating right now</span>}</>}
        </div>
      )}

      <div style={{ marginTop: '1.75rem' }}>
        <Fact label="Operator" value={reactor.operator} />
        <Fact label="State" value={reactor.state} />
        <Fact label="Capacity" value={cap ? `${Math.round(cap).toLocaleString()} MW` : '—'} />
        <Fact label="Commercial operation" value={fmtYear(reactor.commercial_operation_date)} />
        <Fact label="License expiration" value={fmtYear(reactor.license_expiration_date)} />
        <Fact label="ISO / RTO" value={reactor.iso_rto ?? '—'} />
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--color-brand)', marginTop: '2rem', marginBottom: '0.6rem' }}>License history</h3>
      {actions.length > 0
        ? actions.map(a => <LicenseActionLine key={a.id} action={a} />)
        : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No NRC license-renewal actions on record for this unit.</p>}

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--color-brand)', marginTop: '2rem', marginBottom: '0.6rem' }}>Power, last 90 days</h3>
      <PowerSparkline reactorId={reactor.id} />

      <NewsForEntity
        newsItems={newsItems}
        terms={[reactor.plant_name, reactor.operator]}
        title="In the news"
      />

      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2rem' }}>
        Power status from the U.S. NRC daily report; license records from NRC renewal filings. See{' '}
        <a href="/sources" style={{ color: 'var(--color-brand)' }}>how we calculated this</a>.
      </p>
    </section>
  )
}
