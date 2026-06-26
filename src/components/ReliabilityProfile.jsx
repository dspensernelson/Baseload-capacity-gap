import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import supabase from '../supabase'

const ORDER = ['nuclear', 'hydro', 'gas', 'coal', 'wind', 'solar', 'other']
const LABEL = {
  nuclear: 'Nuclear',
  hydro: 'Hydro',
  gas: 'Natural gas',
  coal: 'Coal',
  wind: 'Wind',
  solar: 'Solar',
  other: 'Other',
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.77rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{LABEL[d.source_key] ?? d.source_key}</div>
      <div>Variability (CV): <strong>{d.cv_pct?.toFixed?.(1) ?? d.cv_pct}%</strong></div>
      <div>P95 hourly ramp: <strong>{d.ramp95_gw?.toFixed?.(1) ?? d.ramp95_gw} GW</strong></div>
      <div>P10-P90 range: <strong>{d.p10_gw?.toFixed?.(1) ?? d.p10_gw} - {d.p90_gw?.toFixed?.(1) ?? d.p90_gw} GW</strong></div>
    </div>
  )
}

export default function ReliabilityProfile() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    supabase
      .from('grid_reliability_source_stats_30d')
      .select('source_key, avg_gw, p10_gw, p90_gw, cv_pct, ramp95_gw, hours_observed')
      .then(({ data, error: qErr }) => {
        if (!alive) return
        if (qErr) {
          setError('Reliability profile is temporarily unavailable.')
          setRows([])
          return
        }
        setRows(data || [])
      })
      .catch(() => {
        if (alive) {
          setError('Reliability profile is temporarily unavailable.')
          setRows([])
        }
      })
    return () => { alive = false }
  }, [])

  const sorted = useMemo(() => {
    if (!rows) return null
    return [...rows].sort((a, b) => {
      const ia = ORDER.indexOf(a.source_key)
      const ib = ORDER.indexOf(b.source_key)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [rows])

  if (!sorted) return null
  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!sorted.length) return null

  const nuke = sorted.find(r => r.source_key === 'nuclear')
  const solar = sorted.find(r => r.source_key === 'solar')
  const wind = sorted.find(r => r.source_key === 'wind')
  const cvLead = nuke && solar && wind
    ? `Nuclear's 30-day variability (${Number(nuke.cv_pct).toFixed(1)}%) is far below solar (${Number(solar.cv_pct).toFixed(1)}%) and wind (${Number(wind.cv_pct).toFixed(1)}%).`
    : 'Trailing 30-day variability by source from hourly U.S. generation.'

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.05rem 1.25rem', marginBottom: '1.2rem', lineHeight: 1.55 }}>
        <div style={{ fontSize: '0.95rem' }}>{cvLead}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.45rem' }}>
          Reliability profile = how much each source swings hour to hour (coefficient of variation and ramp stress).
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={sorted} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="source_key" tickFormatter={k => LABEL[k] ?? k} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="cv_pct" fill="var(--color-brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.55rem' }}>
        Trailing 30 days, hourly U.S. generation by source. Source: EIA Hourly Electric Grid Monitor (EIA-930).
      </p>
    </div>
  )
}
