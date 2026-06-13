import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import supabase from '../supabase'

const END_YEAR = 2045

function buildScenario(reactors, projects, { renewalRate, slipYears, landRate }) {
  const startYear = new Date().getFullYear()
  const operating = reactors.filter(r => r.status === 'operating' || r.status === 'license_renewed')
  const operatingMW = operating.reduce((s, r) => s + (parseFloat(r.capacity_mw) || 0), 0)

  // Retirements by year — the (1 − renewalRate) share retires at license expiry;
  // the renewed share is pushed +20 years (usually out of the window → it stays).
  const retire = {}
  operating.forEach(r => {
    const cap = parseFloat(r.capacity_mw) || 0
    const exp = r.license_expiration_date ? new Date(r.license_expiration_date).getFullYear() : null
    if (!exp) return
    const retired = cap * (1 - renewalRate / 100)
    const renewed = cap * (renewalRate / 100)
    if (exp >= startYear && exp <= END_YEAR) retire[exp] = (retire[exp] || 0) + retired
    const ext = exp + 20
    if (ext >= startYear && ext <= END_YEAR) retire[ext] = (retire[ext] || 0) + renewed
  })

  // Additions by year — shifted by slipYears, scaled by landRate.
  const add = {}
  projects.forEach(p => {
    const cap = (parseFloat(p.capacity_mw) || 0) * (landRate / 100)
    const yr = parseInt(p.target_online_year, 10)
    if (!yr) return
    const y = yr + slipYears
    if (y >= startYear && y <= END_YEAR) add[y] = (add[y] || 0) + cap
  })

  const data = []
  let cumR = 0, cumA = 0
  for (let y = startYear; y <= END_YEAR; y++) {
    cumR += retire[y] || 0
    cumA += add[y] || 0
    const net = operatingMW - cumR + cumA
    data.push({
      year: y,
      net: +(net / 1000).toFixed(2),
      gap: +(Math.max(0, operatingMW - net) / 1000).toFixed(2),
    })
  }
  return { data, operatingGW: operatingMW / 1000 }
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
        <span style={{ color: 'var(--color-text)' }}>{label}</span>
        <strong style={{ color: 'var(--color-brand)' }}>{fmt(value)}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-brand)' }} />
    </div>
  )
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.8rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ color: 'var(--color-operating)' }}>Fleet: {d.net.toFixed(1)} GW</div>
      {d.gap > 0 && <div style={{ color: 'var(--color-amber)' }}>Below today: {d.gap.toFixed(1)} GW</div>}
    </div>
  )
}

export default function Scenarios({ reactors }) {
  const [projects, setProjects] = useState([])
  const [renewalRate, setRenewalRate] = useState(0)
  const [slipYears, setSlipYears] = useState(0)
  const [landRate, setLandRate] = useState(100)

  useEffect(() => {
    let alive = true
    supabase.from('new_reactor_projects').select('capacity_mw, target_online_year')
      .then(({ data }) => { if (alive) setProjects(data ?? []) })
    return () => { alive = false }
  }, [])

  const { data, operatingGW } = useMemo(
    () => buildScenario(reactors, projects, { renewalRate, slipYears, landRate }),
    [reactors, projects, renewalRate, slipYears, landRate]
  )

  const at2035 = data.find(d => d.year === 2035)
  const fleet2045 = data[data.length - 1]
  const yMax = Math.ceil((Math.max(operatingGW, ...data.map(d => d.net)) + 10) / 10) * 10

  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Scenarios</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem' }}>
        The gap isn't fixed — it depends on choices. Drag the levers and watch it open and close. The chart
        recomputes live from the real reactor licenses and the announced build pipeline.
      </p>

      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: '2rem' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <Slider label="Future license renewals" value={renewalRate} min={0} max={100} step={5}
            onChange={setRenewalRate} fmt={v => `${v}% of expiring`} />
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '-0.7rem', marginBottom: '1rem' }}>
            History says nearly every reactor renews — so reality likely sits near the top of this slider.
          </div>
          <Slider label="Pipeline delay" value={slipYears} min={0} max={10} step={1}
            onChange={setSlipYears} fmt={v => v === 0 ? 'on schedule' : `+${v} yr`} />
          <Slider label="Pipeline that gets built" value={landRate} min={0} max={100} step={5}
            onChange={setLandRate} fmt={v => `${v}%`} />

          <div style={{ marginTop: '1.5rem', padding: '1rem 1.2rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fleet vs. today, 2035</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: at2035 && at2035.gap > 0.05 ? 'var(--color-amber)' : 'var(--color-operating)', lineHeight: 1.1 }}>
              {at2035 ? (at2035.gap > 0.05 ? `−${at2035.gap.toFixed(1)} GW` : `+${(at2035.net - operatingGW).toFixed(1)} GW`) : '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              Fleet in 2045: <strong>{fleet2045 ? fleet2045.net.toFixed(0) : '—'} GW</strong> (today ≈ {operatingGW.toFixed(0)} GW)
            </div>
          </div>
        </div>

        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="year" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={28} />
              <YAxis domain={[0, yMax]} tickFormatter={v => `${v}`} tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={34} label={{ value: 'GW', position: 'insideTopLeft', offset: -2, fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="net" stackId="1" stroke="var(--color-operating)" strokeWidth={1.5} fill="var(--color-operating)" fillOpacity={0.85} isAnimationActive={false} />
              <Area type="monotone" dataKey="gap" stackId="1" stroke="none" fill="var(--color-amber)" fillOpacity={0.7} isAnimationActive={false} />
              <ReferenceLine y={operatingGW} stroke="var(--color-text-muted)" strokeDasharray="4 3" strokeWidth={1} label={{ value: `today ≈ ${operatingGW.toFixed(0)} GW`, position: 'insideTopRight', fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <ReferenceLine x={2035} stroke="var(--color-brand)" strokeDasharray="4 2" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>
            Green = projected nuclear capacity; amber = how far below today's fleet it falls. Built from NRC license
            expirations + announced new build. A model, not a forecast — see <a href="/methodology.html" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)' }}>methodology</a>.
          </p>
        </div>
      </div>
    </section>
  )
}
