import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import supabase from '../supabase'

const HUBS = [
  { key: 'NP15', label: 'NP15 (Northern CA)', color: 'var(--color-pipeline)' },
  { key: 'SP15', label: 'SP15 (Southern CA)', color: 'var(--color-demand)' },
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
          <span>{HUBS.find(h => h.key === p.dataKey)?.label}</span><span>${p.value?.toFixed(0)}/MWh</span>
        </div>
      ))}
    </div>
  )
}

export default function WholesalePrices() {
  const [hours, setHours] = useState(null)

  useEffect(() => {
    let alive = true
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    supabase
      .from('wholesale_prices')
      .select('hub, interval_start, price_usd_mwh')
      .eq('iso', 'CAISO')
      .eq('market', 'day_ahead')
      .gte('interval_start', since)
      .order('interval_start')
      .then(({ data }) => {
        if (!alive || !data) return
        const byHour = new Map()
        for (const r of data) {
          if (!byHour.has(r.interval_start)) byHour.set(r.interval_start, { iso: r.interval_start })
          byHour.get(r.interval_start)[r.hub] = parseFloat(r.price_usd_mwh)
        }
        const arr = [...byHour.values()].map(h => {
          h.t = fmtPT(h.iso, { hour: 'numeric' })
          h.full = fmtPT(h.iso, { weekday: 'short', hour: 'numeric' })
          return h
        })
        setHours(arr)
      })
    return () => { alive = false }
  }, [])

  if (!hours || hours.length < 6) return null

  const last24 = hours.slice(-24).filter(h => h.SP15 != null)
  if (!last24.length) return null
  const cheapest = last24.reduce((m, h) => (h.SP15 < m.SP15 ? h : m), last24[0])
  const priciest = last24.reduce((m, h) => (h.SP15 > m.SP15 ? h : m), last24[0])

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.35rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        <div style={{ fontSize: '0.95rem' }}>
          At <strong>{fmtPT(cheapest.iso, { hour: 'numeric' })} PT</strong>, California wholesale power cost just{' '}
          <strong style={{ color: 'var(--color-operating)' }}>${cheapest.SP15.toFixed(0)}/MWh</strong> — midday solar floods the
          grid. By <strong>{fmtPT(priciest.iso, { hour: 'numeric' })} PT</strong>, the same day, price had jumped to{' '}
          <strong style={{ color: 'var(--color-decommissioning)' }}>${priciest.SP15.toFixed(0)}/MWh</strong> as the sun went down
          and demand didn't.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          That swing is the cost of intermittency — flat, predictable output doesn't carry that price risk.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginBottom: '0.75rem' }}>
        {HUBS.map(h => (
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
          {HUBS.map(h => (
            <Line key={h.key} type="monotone" dataKey={h.key} stroke={h.color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>
        CAISO day-ahead hourly locational marginal price, last 48 hours. Times Pacific. Source: CAISO OASIS
        (PRC_LMP, market_run_id=DAM). Pilot: California only — more ISOs may follow.
      </p>
    </div>
  )
}
