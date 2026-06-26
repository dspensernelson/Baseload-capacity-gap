import { useEffect, useState } from 'react'
import supabase from '../supabase'

function n(v, d = 1) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toFixed(d)
}

export default function FirmingSnapshot() {
  const [row, setRow] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    supabase
      .from('grid_firming_snapshot_30d')
      .select('*')
      .maybeSingle()
      .then(({ data, error: qErr }) => {
        if (!alive) return
        if (qErr) {
          setError('Firming snapshot is temporarily unavailable.')
          setRow(null)
          return
        }
        setRow(data || null)
      })
      .catch(() => {
        if (alive) {
          setError('Firming snapshot is temporarily unavailable.')
          setRow(null)
        }
      })

    return () => { alive = false }
  }, [])

  if (error) return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  if (!row) return null

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.15rem 1.3rem', lineHeight: 1.6 }}>
      <div style={{ fontSize: '0.95rem' }}>
        Over the last 30 days, during overnight hours (12 a.m.-6 a.m. ET), nuclear supplied about{' '}
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

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.65rem', marginBottom: 0 }}>
        Derived from hourly U.S. generation (EIA-930), trailing 30 days; low-renewables threshold = 15% of total generation.
      </p>
    </div>
  )
}
