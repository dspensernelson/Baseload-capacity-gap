import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import supabase from '../supabase'

function n(v, d = 1) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toFixed(d)
}

export default function FirmingSnapshot() {
  const [row, setRow] = useState(null)
  const [trend, setTrend] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    const since = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    supabase
      .from('grid_firming_daily')
      .select('*')
      .gte('snapshot_date', since)
      .order('snapshot_date')
      .then(({ data, error: qErr }) => {
        if (!alive) return
        if (qErr) {
          setError('Firming snapshot is temporarily unavailable.')
          setRow(null)
          setTrend([])
          return
        }
        const arr = data || []
        setTrend(arr)
        setRow(arr.length ? arr[arr.length - 1] : null)
      })
      .catch(() => {
        if (alive) {
          setError('Firming snapshot is temporarily unavailable.')
          setRow(null)
          setTrend([])
        }
      })

    return () => { alive = false }
  }, [])

  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!row) return null

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.15rem 1.3rem', lineHeight: 1.6 }}>
      <div style={{ fontSize: '0.95rem' }}>
        In the latest daily snapshot, during overnight hours (12 a.m.-6 a.m. ET), nuclear supplied about{' '}
        <strong>{n(row.overnight_nuclear_share_pct)}%</strong> of total U.S. generation while solar averaged{' '}
        <strong>{n(row.overnight_solar_gw)} GW</strong>. In hours where wind+solar together fell below 15% of the grid,
        nuclear's average share rose to <strong>{n(row.nuclear_share_when_low_renewables_pct)}%</strong>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginTop: '0.9rem' }}>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight nuclear</div>
          <div style={{ fontWeight: 600 }}>{n(row.overnight_nuclear_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight wind</div>
          <div style={{ fontWeight: 600 }}>{n(row.overnight_wind_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Overnight solar</div>
          <div style={{ fontWeight: 600 }}>{n(row.overnight_solar_gw)} GW</div>
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.55rem 0.7rem', background: '#fff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Midday solar</div>
          <div style={{ fontWeight: 600 }}>{n(row.midday_solar_gw)} GW</div>
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
        Daily materialized snapshots from hourly U.S. generation (EIA-930); low-renewables threshold = 15% of total generation.
      </p>
    </div>
  )
}
