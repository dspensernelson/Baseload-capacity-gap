import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

const TREND_SOURCES = [
  { key: 'nuclear', color: '#2d6a4f', label: 'Nuclear' },
  { key: 'wind', color: '#457b9d', label: 'Wind' },
  { key: 'solar', color: '#f6c453', label: 'Solar' },
]

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p0 = payload[0]
  const d = p0.payload || {}
  const sourceKey = String(p0.dataKey || '').replace(/_cv$/, '')
  const row = d[`${sourceKey}_row`] || {}
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.77rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{LABEL[row.source_key || sourceKey] ?? sourceKey}</div>
      <div>Date: <strong>{row.snapshot_date || d.date}</strong></div>
      <div>Variability (CV): <strong>{Number(row.cv_pct || d[p0.dataKey] || 0).toFixed(1)}%</strong></div>
      <div>P95 hourly ramp: <strong>{Number(row.ramp95_gw || 0).toFixed(1)} GW</strong></div>
      <div>P10-P90 range: <strong>{Number(row.p10_gw || 0).toFixed(1)} - {Number(row.p90_gw || 0).toFixed(1)} GW</strong></div>
    </div>
  )
}

export default function ReliabilityProfile() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    const since = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    supabase
      .from('grid_reliability_daily')
      .select('snapshot_date, source_key, avg_gw, p10_gw, p90_gw, cv_pct, ramp95_gw, hours_observed')
      .gte('snapshot_date', since)
      .in('source_key', ORDER)
      .order('snapshot_date')
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
      if (a.snapshot_date !== b.snapshot_date) return a.snapshot_date.localeCompare(b.snapshot_date)
      const ia = ORDER.indexOf(a.source_key)
      const ib = ORDER.indexOf(b.source_key)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [rows])

  const trendData = useMemo(() => {
    if (!sorted) return []
    const byDay = new Map()
    for (const r of sorted) {
      if (!byDay.has(r.snapshot_date)) byDay.set(r.snapshot_date, { date: r.snapshot_date })
      const d = byDay.get(r.snapshot_date)
      d[`${r.source_key}_cv`] = Number(r.cv_pct)
      d[`${r.source_key}_row`] = r
    }
    return [...byDay.values()].slice(-30)
  }, [sorted])

  const latestBySource = useMemo(() => {
    const out = {}
    for (const r of sorted || []) out[r.source_key] = r
    return out
  }, [sorted])

  if (!sorted) return null
  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!sorted.length) return null

  const nuke = latestBySource.nuclear
  const solar = latestBySource.solar
  const wind = latestBySource.wind
  const cvLead = nuke && solar && wind
    ? `Nuclear's 30-day variability (${Number(nuke.cv_pct).toFixed(1)}%) is far below solar (${Number(solar.cv_pct).toFixed(1)}%) and wind (${Number(wind.cv_pct).toFixed(1)}%).`
    : 'Daily reliability snapshots are computed from hourly U.S. generation.'

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.05rem 1.25rem', marginBottom: '1.2rem', lineHeight: 1.55 }}>
        <div style={{ fontSize: '0.95rem' }}>{cvLead}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.45rem' }}>
          Autonomously materialized daily from EIA-930 data by the grid-reliability cron.
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={28} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={<Tip />} />
          {TREND_SOURCES.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={`${s.key}_cv`}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
              name={s.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginTop: '0.6rem' }}>
        {TREND_SOURCES.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 2.5, background: s.color, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.55rem' }}>
        Daily snapshots from hourly U.S. generation by source. Source: EIA Hourly Electric Grid Monitor (EIA-930).
      </p>
    </div>
  )
}
