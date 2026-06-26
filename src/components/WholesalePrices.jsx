import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import supabase from '../supabase'

const SERIES_BY_MARKET = {
  day_ahead: [
    { key: 'CAISO_NP15', iso: 'CAISO', hub: 'NP15', label: 'CAISO NP15', color: 'var(--color-pipeline)' },
    { key: 'CAISO_SP15', iso: 'CAISO', hub: 'SP15', label: 'CAISO SP15', color: 'var(--color-demand)' },
    { key: 'NYISO_NYC', iso: 'NYISO', hub: 'N.Y.C.', label: 'NYISO NYC', color: '#1f78b4' },
    { key: 'NYISO_LONGIL', iso: 'NYISO', hub: 'LONGIL', label: 'NYISO Long Island', color: '#d95f02' },
    { key: 'PJM_WEST', iso: 'PJM', hub: 'WEST', label: 'PJM West (optional)', color: '#4daf4a' },
  ],
  real_time: [
    { key: 'CAISO_NP15', iso: 'CAISO', hub: 'NP15', label: 'CAISO NP15', color: 'var(--color-pipeline)' },
    { key: 'CAISO_SP15', iso: 'CAISO', hub: 'SP15', label: 'CAISO SP15', color: 'var(--color-demand)' },
    { key: 'NYISO_NYC', iso: 'NYISO', hub: 'N.Y.C.', label: 'NYISO NYC', color: '#1f78b4' },
    { key: 'NYISO_LONGIL', iso: 'NYISO', hub: 'LONGIL', label: 'NYISO Long Island', color: '#d95f02' },
    { key: 'ERCOT_HBHOUSTON', iso: 'ERCOT', hub: 'HB_HOUSTON', label: 'ERCOT Houston Hub', color: '#7570b3' },
    { key: 'ERCOT_HBNORTH', iso: 'ERCOT', hub: 'HB_NORTH', label: 'ERCOT North Hub', color: '#66a61e' },
  ],
}

const PREFERRED_FOCUS = {
  day_ahead: ['CAISO_SP15', 'NYISO_NYC', 'CAISO_NP15', 'NYISO_LONGIL', 'PJM_WEST'],
  real_time: ['CAISO_SP15', 'NYISO_NYC', 'ERCOT_HBHOUSTON', 'CAISO_NP15', 'ERCOT_HBNORTH', 'NYISO_LONGIL'],
}

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
          <span>{([...(SERIES_BY_MARKET.day_ahead || []), ...(SERIES_BY_MARKET.real_time || [])].find(h => h.key === p.dataKey)?.label || p.dataKey)}</span><span>${p.value?.toFixed(0)}/MWh</span>
        </div>
      ))}
    </div>
  )
}

export default function WholesalePrices() {
  const [hours, setHours] = useState(null)
  const [error, setError] = useState('')
  const [market, setMarket] = useState('day_ahead')

  useEffect(() => {
    let alive = true
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    setError('')
    supabase
      .from('wholesale_prices')
      .select('iso, hub, market, interval_start, price_usd_mwh')
      .in('iso', ['CAISO', 'NYISO', 'ERCOT', 'PJM'])
      .in('market', ['day_ahead', 'real_time'])
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
        const makeSeriesKey = (iso, hub) => {
          const normHub = String(hub || '').replace(/[^A-Za-z0-9]+/g, '')
          return `${iso}_${normHub}`
        }
        for (const r of data) {
          const bucketKey = `${r.market}|${r.interval_start}`
          if (!byHour.has(bucketKey)) byHour.set(bucketKey, { iso: r.interval_start, market: r.market })
          const seriesKey = makeSeriesKey(r.iso, r.hub)
          byHour.get(bucketKey)[seriesKey] = parseFloat(r.price_usd_mwh)
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

  const marketHours = hours.filter(h => h.market === market)
  if (marketHours.length < 6) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Not enough recent {market.replace('_', ' ')} price data yet.</p>
  }

  const seriesForMarket = SERIES_BY_MARKET[market] || []
  const activeSeries = seriesForMarket.filter(s => marketHours.some(h => h[s.key] != null))
  if (!activeSeries.length) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Not enough recent wholesale price data yet.</p>
  }

  const preferredOrder = PREFERRED_FOCUS[market] || []
  const focusKey = preferredOrder.find(k => activeSeries.some(s => s.key === k))
  if (!focusKey) return null

  const focusLabel = seriesForMarket.find(s => s.key === focusKey)?.label ?? focusKey
  const last24 = marketHours.slice(-24).filter(h => h[focusKey] != null)
  if (!last24.length) return null
  const cheapest = last24.reduce((m, h) => (h[focusKey] < m[focusKey] ? h : m), last24[0])
  const priciest = last24.reduce((m, h) => (h[focusKey] > m[focusKey] ? h : m), last24[0])


  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.35rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.8rem' }}>
          {[
            { key: 'day_ahead', label: 'Day-Ahead' },
            { key: 'real_time', label: 'Real-Time' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setMarket(opt.key)}
              style={{
                border: market === opt.key ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: market === opt.key ? 'var(--color-brand)' : '#fff',
                color: market === opt.key ? '#fff' : 'var(--color-text-muted)',
                borderRadius: '7px', padding: '0.28rem 0.62rem', fontSize: '0.76rem', cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
        <LineChart data={marketHours} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
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
        {market === 'day_ahead' ? 'Day-ahead' : 'Real-time'} locational marginal price, last 48 hours. Times shown in Pacific time.
        Sources: CAISO OASIS, NYISO public MIS CSV, ERCOT public MIS CDR feed, and optional PJM Data Miner integration.
      </p>
    </div>
  )
}
