import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import supabase from '../supabase'

// Bottom → top stack order; nuclear sits at the base as the steady foundation.
const SOURCES = [
  { key: 'nuclear', label: 'Nuclear',     color: '#2d6a4f' },
  { key: 'coal',    label: 'Coal',        color: '#5f5e5a' },
  { key: 'gas',     label: 'Natural gas', color: '#8d99ae' },
  { key: 'hydro',   label: 'Hydro',       color: '#2a9d8f' },
  { key: 'wind',    label: 'Wind',        color: '#457b9d' },
  { key: 'solar',   label: 'Solar',       color: '#f6c453' },
  { key: 'other',   label: 'Other',       color: '#cdd0cb' },
]

const BUCKET = {
  NUC: 'nuclear', COL: 'coal', NG: 'gas', WAT: 'hydro',
  WND: 'wind', WNB: 'wind', SUN: 'solar', SNB: 'solar',
}

function fmtET(iso, opts) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', ...opts })
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.78rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      {[...payload].reverse().map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{SOURCES.find(s => s.key === p.dataKey)?.label}</span><span>{p.value?.toFixed(0)} GW</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.3rem', paddingTop: '0.2rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Total</span><span>{total.toFixed(0)} GW</span>
      </div>
    </div>
  )
}

export default function GridMix() {
  const [hours, setHours] = useState(null)

  useEffect(() => {
    let alive = true
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    supabase
      .from('generation_hourly')
      .select('period_utc, fueltype, mwh')
      .gte('period_utc', since)
      .order('period_utc')
      .then(({ data }) => {
        if (!alive || !data) return
        const byHour = new Map()
        for (const r of data) {
          if (!byHour.has(r.period_utc)) byHour.set(r.period_utc, { iso: r.period_utc })
          const row = byHour.get(r.period_utc)
          const bucket = BUCKET[r.fueltype] ?? 'other'
          row[bucket] = (row[bucket] || 0) + parseFloat(r.mwh) / 1000
        }
        const arr = [...byHour.values()].map(h => {
          for (const s of SOURCES) h[s.key] = Math.max(0, h[s.key] || 0)
          h.t = fmtET(h.iso, { hour: 'numeric' })
          h.full = fmtET(h.iso, { weekday: 'short', hour: 'numeric' })
          h.total = SOURCES.reduce((s, x) => s + h[x.key], 0)
          return h
        })
        setHours(arr)
      })
    return () => { alive = false }
  }, [])

  if (!hours || hours.length < 6) return null

  const last24 = hours.slice(-24)
  const night = last24.reduce((m, h) => (h.solar < m.solar ? h : m), last24[0])
  const day   = last24.reduce((m, h) => (h.solar > m.solar ? h : m), last24[0])
  const nukeSharePctNight = night.total ? Math.round((night.nuclear / night.total) * 100) : 0

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.35rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        <div style={{ fontSize: '0.95rem' }}>
          In the dead of night (<strong>{fmtET(night.iso, { weekday: 'long', hour: 'numeric' })} ET</strong>), solar produced{' '}
          <strong style={{ color: '#b8860b' }}>{night.solar.toFixed(0)} GW</strong> — essentially nothing — while nuclear delivered{' '}
          <strong style={{ color: 'var(--color-operating)' }}>{night.nuclear.toFixed(0)} GW</strong>, about <strong>{nukeSharePctNight}%</strong> of the entire grid.
          By midday solar surged to <strong style={{ color: '#b8860b' }}>{day.solar.toFixed(0)} GW</strong> — and nuclear didn't move ({day.nuclear.toFixed(0)} GW).
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          That flat nuclear band is the point: same output at 3 a.m. as at noon.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginBottom: '0.75rem' }}>
        {[...SOURCES].reverse().map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />{s.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={hours} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="t" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={36} />
          <YAxis tickFormatter={v => `${v}`} tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={34} label={{ value: 'GW', position: 'insideTopLeft', offset: -2, fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <Tooltip content={<Tip />} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''} />
          {SOURCES.map(s => (
            <Area key={s.key} type="monotone" dataKey={s.key} stackId="1" stroke={s.color} fill={s.color} fillOpacity={s.key === 'nuclear' ? 0.9 : 0.6} strokeWidth={s.key === 'nuclear' ? 1.5 : 0.5} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>
        U.S. Lower-48 net generation by source, last 48 hours, hourly. Times Eastern. Source: EIA Hourly Electric Grid Monitor (EIA-930).
      </p>
    </div>
  )
}
