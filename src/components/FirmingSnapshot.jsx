import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import supabase from '../supabase'

function n(v, d = 1) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toFixed(d)
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

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function groupDaily(rows) {
  const byHour = new Map()
  for (const r of rows) {
    const dt = new Date(String(r.period_utc || ''))
    if (Number.isNaN(dt.getTime())) continue
    const date = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const etHour = Number(dt.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }))
    const key = `${date}|${etHour}`
    if (!byHour.has(key)) byHour.set(key, { date, etHour, nuclear: 0, wind: 0, solar: 0, total: 0 })
    const p = byHour.get(key)
    const gw = Number(r.mwh || 0) / 1000
    const src = bucket(r.fueltype)
    p.total += gw
    if (src in p) p[src] += gw
  }

  const byDay = new Map()
  for (const p of byHour.values()) {
    if (!byDay.has(p.date)) byDay.set(p.date, [])
    byDay.get(p.date).push(p)
  }

  const daily = []
  for (const [date, hours] of byDay.entries()) {
    hours.sort((a, b) => a.etHour - b.etHour)
    const overnight = hours.filter(h => h.etHour >= 0 && h.etHour <= 5 && h.total > 0)
    const midday = hours.filter(h => h.etHour >= 11 && h.etHour <= 15 && h.total > 0)
    const lowRenew = hours.filter(h => h.total > 0 && ((h.wind + h.solar) / h.total) < 0.15)

    if (hours.length < 6) continue

    daily.push({
      snapshot_date: date,
      overnight_nuclear_gw: mean(overnight.map(h => h.nuclear)),
      overnight_solar_gw: mean(overnight.map(h => h.solar)),
      overnight_wind_gw: mean(overnight.map(h => h.wind)),
      overnight_total_gw: mean(overnight.map(h => h.total)),
      midday_solar_gw: mean(midday.map(h => h.solar)),
      overnight_nuclear_share_pct: overnight.length ? 100 * (mean(overnight.map(h => h.nuclear)) / mean(overnight.map(h => h.total))) : 0,
      low_renewables_hours_pct: hours.length ? 100 * (lowRenew.length / hours.length) : 0,
      nuclear_share_when_low_renewables_pct: lowRenew.length ? 100 * mean(lowRenew.map(h => h.nuclear / h.total)) : 0,
      hours_observed: hours.length,
    })
  }

  daily.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  return daily.slice(-35)
}

export default function FirmingSnapshot() {
  const [trend, setTrend] = useState(null)
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
          setError('Firming snapshot is temporarily unavailable.')
          setTrend([])
          return
        }
        setTrend(groupDaily(data || []))
      })
      .catch(() => {
        if (alive) {
          setError('Firming snapshot is temporarily unavailable.')
          setTrend([])
        }
      })
    return () => { alive = false }
  }, [])

  const latest = useMemo(() => (trend && trend.length ? trend[trend.length - 1] : null), [trend])

  if (trend == null) return null
  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!latest) return null

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.15rem 1.3rem', lineHeight: 1.6 }}>
      <div style={{ fontSize: '0.95rem' }}>
        In the latest daily snapshot, during overnight hours (12 a.m.-6 a.m. ET), nuclear supplied about{' '}
        <strong>{n(latest.overnight_nuclear_share_pct)}%</strong> of total U.S. generation while solar averaged{' '}
        <strong>{n(latest.overnight_solar_gw)} GW</strong>. In hours where wind+solar together fell below 15% of the grid,
        nuclear's average share rose to <strong>{n(latest.nuclear_share_when_low_renewables_pct)}%</strong>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginTop: '0.9rem' }}>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight nuclear</div>
          <div style={{ fontWeight: 600 }}>{n(latest.overnight_nuclear_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight wind</div>
          <div style={{ fontWeight: 600 }}>{n(latest.overnight_wind_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight solar</div>
          <div style={{ fontWeight: 600 }}>{n(latest.overnight_solar_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Midday solar</div>
          <div style={{ fontWeight: 600 }}>{n(latest.midday_solar_gw)} GW</div>
        </div>
      </div>

      <div style={{ marginTop: '0.95rem' }}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="snapshot_date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={24} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
            <Line type="monotone" dataKey="overnight_nuclear_share_pct" stroke="var(--color-operating)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls name="Overnight nuclear share" />
            <Line type="monotone" dataKey="nuclear_share_when_low_renewables_pct" stroke="var(--color-brand)" strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls name="Nuclear share when wind+solar < 15%" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.65rem', marginBottom: 0 }}>
        Live snapshots computed from hourly U.S. generation by source. Source: EIA Hourly Electric Grid Monitor (EIA-930).
      </p>
    </div>
  )
}