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
  const point = payload[0]?.payload || {}
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.77rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{point.date}</div>
      {TREND_SOURCES.map(s => (
        <div key={s.key} style={{ color: s.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{s.label}</span>
          <span>{Number(point[`${s.key}_cv`] || 0).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function bucket(fueltype) {
  const ft = String(fueltype || '').trim().toUpperCase()
  if (ft === 'NUC') return 'nuclear'
  if (ft === 'COL') return 'coal'
  if (ft === 'NG') return 'gas'
  if (ft === 'WAT') return 'hydro'
  if (ft === 'WND' || ft === 'WNB') return 'wind'
  if (ft === 'SUN' || ft === 'SNB') return 'solar'
  return 'other'
}

function pct(values, p) {
  if (!values.length) return 0
  const arr = [...values].sort((a, b) => a - b)
  if (arr.length === 1) return arr[0]
  const idx = (arr.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return arr[lo]
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo)
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function stdevPop(values) {
  if (!values.length) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length)
}

function groupDaily(rows) {
  const byHour = new Map()
  for (const r of rows) {
    const iso = String(r.period_utc || '')
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) continue
    const date = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const hour = new Date(dt.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const hourKey = hour.toISOString().slice(0, 13)
    const sourceKey = bucket(r.fueltype)
    const gw = Number(r.mwh || 0) / 1000
    const key = `${date}|${hourKey}`
    if (!byHour.has(key)) byHour.set(key, { date, hour: hour.getHours() })
    const point = byHour.get(key)
    point[sourceKey] = (point[sourceKey] || 0) + gw
  }

  const grouped = new Map()
  for (const point of byHour.values()) {
    if (!grouped.has(point.date)) grouped.set(point.date, [])
    grouped.get(point.date).push(point)
  }

  const daily = []
  for (const [date, points] of grouped.entries()) {
    const sourceSeries = {}
    const totalSeries = {}
    for (const p of points) {
      const total = ORDER.reduce((sum, key) => sum + Number(p[key] || 0), 0)
      totalSeries[p.hour] = total
      for (const key of ORDER) {
        if (!sourceSeries[key]) sourceSeries[key] = []
        sourceSeries[key].push(Number(p[key] || 0))
      }
    }

    if (points.length < 6) continue
    const row = { snapshot_date: date }
    for (const key of ORDER) {
      const vals = sourceSeries[key]
      if (!vals || !vals.length) continue
      const avg = mean(vals)
      const deltas = vals.slice(1).map((v, i) => Math.abs(v - vals[i]))
      row[`${key}_cv`] = avg ? (stdevPop(vals) / avg) * 100 : 0
      row[`${key}_ramp95`] = pct(deltas, 0.95)
      row[`${key}_p10`] = pct(vals, 0.1)
      row[`${key}_p90`] = pct(vals, 0.9)
      row[`${key}_avg`] = avg
    }
    daily.push(row)
  }

  daily.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  return daily.slice(-35)
}

export default function ReliabilityProfile() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    const since = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    supabase
      .from('generation_hourly')
      .select('period_utc, fueltype, mwh')
      .gte('period_utc', since)
      .order('period_utc')
      .then(({ data, error: qErr }) => {
        if (!alive) return
        if (qErr) {
          setError('Reliability profile is temporarily unavailable.')
          setRows([])
          return
        }
        setRows(groupDaily(data || []))
      })
      .catch(() => {
        if (alive) {
          setError('Reliability profile is temporarily unavailable.')
          setRows([])
        }
      })
    return () => { alive = false }
  }, [])

  const trendData = useMemo(() => rows || [], [rows])
  if (!rows) return null
  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!trendData.length) return null

  const latest = trendData[trendData.length - 1]
  const nuke = latest
  const cvLead = nuke
    ? `Nuclear's latest daily variability (${Number(nuke.nuclear_cv || 0).toFixed(1)}%) stays well below solar (${Number(nuke.solar_cv || 0).toFixed(1)}%) and wind (${Number(nuke.wind_cv || 0).toFixed(1)}%).`
    : 'Daily reliability snapshots are computed from hourly U.S. generation.'

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.05rem 1.25rem', marginBottom: '1.2rem', lineHeight: 1.55 }}>
        <div style={{ fontSize: '0.95rem' }}>{cvLead}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.45rem' }}>
          Live from the EIA-930 feed already flowing through the cron. The same surface can later switch to daily materialization without changing the UI.
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="snapshot_date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={28} />
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
        Daily snapshots computed from hourly U.S. generation by source. Source: EIA Hourly Electric Grid Monitor (EIA-930).
      </p>
    </div>
  )
}