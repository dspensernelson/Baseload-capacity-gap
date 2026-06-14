import FleetOutputChart from '../components/FleetOutputChart'
import CapacityFactor from '../components/CapacityFactor'

function RightNow({ reactors }) {
  let onlineMW = 0, capMW = 0, running = 0, refueling = 0, total = 0
  reactors.forEach(r => {
    if (r.status !== 'operating' && r.status !== 'license_renewed') return
    const cap = parseFloat(r.capacity_mw)
    if (isNaN(cap)) return
    capMW += cap; total += 1
    const pct = parseInt(r.daily_status, 10)
    if (!isNaN(pct)) {
      onlineMW += cap * pct / 100
      if (pct > 0) running += 1; else refueling += 1
    }
  })
  if (!capMW) return null

  const stats = [
    { value: `${Math.round((onlineMW / capMW) * 100)}%`, label: 'of fleet capacity online' },
    { value: `~${(onlineMW / 1000).toFixed(1)} GW`, label: 'generating right now' },
    { value: `${running}/${total}`, label: 'units running' },
    { value: `${refueling}`, label: 'offline for refueling' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', margin: '1.5rem 0 2.5rem' }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 900, color: 'var(--color-brand)', lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Fleet({ fleetSeries, reactors }) {
  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem' }} className="centered">
      <h2 className="section-title">The Fleet</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem' }}>
        The U.S. nuclear fleet, live and over time. On a normal day it doesn't make news — it just runs near
        full output, every hour. Here's what it's doing right now, and across the last year.
      </p>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
        <span className="pulse-dot" style={{ width: 8, height: 8 }} /> Right now
      </div>
      <RightNow reactors={reactors} />

      {fleetSeries.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginBottom: '0.4rem' }}>Last 12 months</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Daily output summed across every reactor — steady near capacity, dipping only for scheduled refueling.
          </p>
          <FleetOutputChart series={fleetSeries} />
        </>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '2.75rem', marginBottom: '0.6rem' }}>Who ran hardest, last 90 days</h3>
      <CapacityFactor />

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2rem' }}>
        Tip: click any reactor on the <a href="/map" style={{ color: 'var(--color-brand)' }}>map</a> to see its 90-day power history.
      </p>
    </section>
  )
}
