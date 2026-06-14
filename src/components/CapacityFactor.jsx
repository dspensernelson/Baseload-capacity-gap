import { useState, useEffect } from 'react'
import supabase from '../supabase'

function Row({ r }) {
  const high = r.avg_power_90d >= 90
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
      <span style={{ flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {r.plant_name} {r.unit_number}
        {r.offline_days > 0 && <span style={{ color: 'var(--color-text-muted)' }}> · {r.offline_days}d off</span>}
      </span>
      <div style={{ flex: '0 0 80px', height: 8, background: 'var(--color-surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, r.avg_power_90d)}%`, height: '100%', background: high ? 'var(--color-operating)' : 'var(--color-amber)' }} />
      </div>
      <span style={{ flex: '0 0 34px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{r.avg_power_90d}%</span>
    </div>
  )
}

function Col({ title, rows }) {
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>{title}</div>
      {rows.map(r => <Row key={r.reactor_id} r={r} />)}
    </div>
  )
}

export default function CapacityFactor() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    supabase.from('reactor_cf_90d').select('*')
      .then(({ data }) => { if (alive) setRows(data ?? []) })
    return () => { alive = false }
  }, [])

  if (!rows || !rows.length) return null
  const steadiest = [...rows].sort((a, b) => b.avg_power_90d - a.avg_power_90d || a.offline_days - b.offline_days).slice(0, 6)
  const downtime  = [...rows].sort((a, b) => a.avg_power_90d - b.avg_power_90d).slice(0, 6)

  return (
    <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
      <Col title="Steadiest (90-day average)" rows={steadiest} />
      <Col title="Most downtime (refueling)" rows={downtime} />
    </div>
  )
}
