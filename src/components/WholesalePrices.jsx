import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import supabase from '../supabase'

const SERIES = [
  { key: 'CAISO_NP15', iso: 'CAISO', hub: 'NP15', label: 'CAISO NP15 (Northern CA)', color: 'var(--color-pipeline)' },
  { key: 'CAISO_SP15', iso: 'CAISO', hub: 'SP15', label: 'CAISO SP15 (Southern CA)', color: 'var(--color-demand)' },
  { key: 'PJM_WEST', iso: 'PJM', hub: 'WEST', label: 'PJM Western Hub', color: '#1f78b4' },
  { key: 'PJM_MIDATL', iso: 'PJM', hub: 'MIDATL', label: 'PJM Mid-Atlantic Hub', color: '#d95f02' },
]

function fmtPT(iso, opts) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts })
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.78rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{SERIES.find(h => h.key === p.dataKey)?.label}</span><span>${p.value?.toFixed(0)}/MWh</span>
        </div>
      ))}
    </div>
  )
}

export default function WholesalePrices() {
  const [hours, setHours] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    setError('')
    supabase
      .from('wholesale_prices')
      .select('iso, hub, interval_start, price_usd_mwh')
      .in('iso', ['CAISO', 'PJM'])
      .eq('market', 'day_ahead')
      .gte('interval_start', since)
      .order('interval_start')
      .then(({ data, error: queryError }) => {
        if (!alive) return
        if (queryError) {
          setError('Wholesale price data is temporarily unavailable.')
          setHours([])
          return
        }
        if (!data) {
          setHours([])
          return
        }
        const byHour = new Map()
        for (const r of data) {
          if (!byHour.has(r.interval_start)) byHour.set(r.interval_start, { iso: r.interval_start })
          const seriesKey = `${r.iso}_${r.hub}`
          byHour.get(r.interval_start)[seriesKey] = parseFloat(r.price_usd_mwh)
        }
        const arr = [...byHour.values()].map(h => {
          h.t = fmtPT(h.iso, { hour: 'numeric' })
          h.full = fmtPT(h.iso, { weekday: 'short', hour: 'numeric' })
          return h
        })
        setHours(arr)
      })
      .catch(() => {
        if (alive) {
          setError('Wholesale price data is temporarily unavailable.')
          setHours([])
        }
      })
    return () => { alive = false }
  }, [])

  if (!hours) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Loading wholesale prices…</p>
  }

  if (error) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{error}</p>
  }

  if (hours.length < 6) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Not enough recent wholesale price data yet.</p>
  }

  const activeSeries = SERIES.filter(s => hours.some(h => h[s.key] != null))
  if (!activeSeries.length) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Not enough recent wholesale price data yet.</p>
  }

  const preferredOrder = ['CAISO_SP15', 'PJM_WEST', 'CAISO_NP15', 'PJM_MIDATL']
  const focusKey = preferredOrder.find(k => activeSeries.some(s => s.key === k))
  if (!focusKey) return null

  const focusLabel = SERIES.find(s => s.key === focusKey)?.label ?? focusKey
  const last24 = hours.slice(-24).filter(h => h[focusKey] != null)
  if (!last24.length) return null
  const cheapest = last24.reduce((m, h) => (h[focusKey] < m[focusKey] ? h : m), last24[0])
  const priciest = last24.reduce((m, h) => (h[focusKey] > m[focusKey] ? h : m), last24[0])


  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.35rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        <div style={{ fontSize: '0.95rem' }}>
          In the last day, <strong>{focusLabel}</strong> traded as low as{' '}
          <strong style={{ color: 'var(--color-operating)' }}>${cheapest[focusKey].toFixed(0)}/MWh</strong> at{' '}
          <strong>{fmtPT(cheapest.iso, { hour: 'numeric' })} PT</strong>, then rose to{' '}
          <strong style={{ color: 'var(--color-decommissioning)' }}>${priciest[focusKey].toFixed(0)}/MWh</strong> at{' '}
          <strong>{fmtPT(priciest.iso, { hour: 'numeric' })} PT</strong>.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          That intraday spread is one way intermittency shows up in dollars.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginBottom: '0.75rem' }}>
        {activeSeries.map(h => (
          <span key={h.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 2.5, background: h.color, display: 'inline-block' }} />{h.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={hours} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="t" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={36} />
          <YAxis tickFormatter={v => `$${v}`} tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={42} />
          <ReferenceLine y={0} stroke="#e0e0e0" />
          <Tooltip content={<Tip />} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''} />
          {activeSeries.map(h => (
            <Line key={h.key} type="monotone" dataKey={h.key} stroke={h.color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>
        Day-ahead hourly locational marginal price, last 48 hours. Times shown in Pacific time. Sources: CAISO OASIS
        (PRC_LMP, market_run_id=DAM) and PJM Data Miner 2 (da_hrl_lmps, when configured).
      </p>
    </div>
  )
}
