import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import supabase from '../supabase'

// "Safety" — the safest-sources case, told honestly. Lead with the accidents people
// remember, then widen to every death (incl. the invisible toll of air pollution) and
// show nuclear is among the very safest. Every figure is cited -> /sources.

const CAT_COLOR = { combustion: '#b04a32', clean: '#3a8a5f' }
const NUKE = '#1d3557'
const colorFor = d => (d.energy_source === 'Nuclear' ? NUKE : CAT_COLOR[d.category] || '#999')
const num = d => ({ ...d, deaths_per_twh: parseFloat(d.deaths_per_twh), ghg_co2e_per_kwh: parseFloat(d.ghg_co2e_per_kwh) })

const DeathTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{d.energy_source}</div>
      <div><strong>{d.deaths_per_twh}</strong> deaths / TWh</div>
      <div style={{ color: 'var(--color-text-muted)' }}>{d.ghg_co2e_per_kwh} gCO₂/kWh</div>
    </div>
  )
}

function INESBadge({ level }) {
  if (level == null) return null
  return (
    <span title={`INES level ${level} of 7`} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: level >= 7 ? 'rgba(176,74,50,0.15)' : 'rgba(0,0,0,0.06)', color: level >= 7 ? '#b04a32' : 'var(--color-text-muted)' }}>
      INES {level}
    </span>
  )
}

export default function Safety() {
  const [safety, setSafety] = useState([])
  const [accidents, setAccidents] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('energy_safety').select('*').order('sort_order'),
      supabase.from('notable_accidents').select('*').order('sort_order'),
    ]).then(([{ data: s }, { data: a }]) => {
      if (!alive) return
      setSafety((s ?? []).map(num))
      setAccidents(a ?? [])
    })
    return () => { alive = false }
  }, [])

  const nuclear = useMemo(() => safety.find(d => d.energy_source === 'Nuclear'), [safety])
  const coal = useMemo(() => safety.find(d => d.energy_source === 'Coal'), [safety])
  const ratio = nuclear && coal ? Math.round(coal.deaths_per_twh / nuclear.deaths_per_twh) : null

  return (
    <section style={{ maxWidth: '1000px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Safety</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1.7, maxWidth: '46rem' }}>
        Nuclear has a reputation problem, and it isn't hard to see why. Three Mile Island. Chernobyl. Fukushima.
        Names that stuck. So let's not dodge them — let's start there, with the real numbers, and then set them
        next to the energy sources nobody is afraid of.
      </p>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '2.5rem', marginBottom: '0.4rem' }}>Start with the ones you remember</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        The full, honest record of nuclear's worst days — and the one almost nobody brings up.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {accidents.map(a => {
          const counter = a.energy_source !== 'Nuclear'
          return (
            <div key={a.slug} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.1rem 1.2rem', background: counter ? 'rgba(58,138,95,0.06)' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{a.name}</span>
                <INESBadge level={a.ines_level} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{a.year} · {a.location}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: counter ? '#b04a32' : 'var(--color-brand)', marginTop: '0.6rem', fontSize: '1.05rem', lineHeight: 1.25 }}>{a.deaths_label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>{a.summary}</div>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '1rem', maxWidth: '46rem', lineHeight: 1.6 }}>
        That last one matters. The deadliest energy accident in history wasn't nuclear — it was a hydroelectric dam.
        We remember the reactors and forget the dam, which tells you something about fear versus arithmetic.
      </p>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>Now count <em>every</em> death</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Not just the dramatic accidents — the quiet, daily toll of air pollution from burning things, too. Per unit
        of energy produced, here is who actually dies.
      </p>

      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={safety} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }}
            label={{ value: 'Deaths per TWh of electricity', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <YAxis type="category" dataKey="energy_source" width={92} tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: 'var(--color-text)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<DeathTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="deaths_per_twh" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {safety.map(d => <Cell key={d.energy_source} fill={colorFor(d)} />)}
            <LabelList dataKey="deaths_per_twh" position="right" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-text)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {ratio && (
        <p style={{ fontSize: '0.95rem', lineHeight: 1.65, marginTop: '1rem', maxWidth: '46rem' }}>
          For a town of 150,000 people, coal-fired power would cause about <strong>25 early deaths a year</strong> —
          almost all from air pollution you can't see. Nuclear, at the same scale, causes one death roughly every
          <strong> 33 years</strong>. Per unit of energy, coal kills around <strong style={{ color: '#b04a32' }}>{ratio.toLocaleString()}×</strong> as many people as nuclear.
        </p>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>Safe <em>and</em> clean</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem', maxWidth: '46rem' }}>
        Safety isn't the whole story — there's carbon, too. The sources toward the bottom-left are both: they kill the
        fewest people <em>and</em> emit the least. Nuclear sits there, with wind and hydro. (Both axes are log scale.)
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 16, right: 28, bottom: 44, left: 12 }}>
          <CartesianGrid stroke="#f0f0f0" />
          <XAxis type="number" dataKey="deaths_per_twh" name="Deaths/TWh" scale="log" domain={[0.01, 30]} ticks={[0.01, 0.1, 1, 10]}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false}
            label={{ value: 'Deaths per TWh  (← safer)', position: 'bottom', offset: 14, fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <YAxis type="number" dataKey="ghg_co2e_per_kwh" name="gCO₂/kWh" scale="log" domain={[8, 1000]} ticks={[10, 100, 1000]}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false}
            label={{ value: 'Lifecycle gCO₂ / kWh', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <Tooltip content={<DeathTip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={safety} isAnimationActive={false}>
            {safety.map(d => <Cell key={d.energy_source} fill={colorFor(d)} />)}
            <LabelList dataKey="energy_source" position="top" style={{ fontSize: 10.5, fontWeight: 600, fill: 'var(--color-text)' }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '2.5rem', padding: '1.1rem 1.3rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)' }}>
        <strong style={{ fontSize: '0.9rem' }}>The honest fine print</strong>
        <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          <li style={{ marginBottom: '0.4rem' }}>Death rates combine accidents <em>and</em> air pollution. For fossil fuels, air pollution is the overwhelming majority — invisible, chronic, and rarely counted.</li>
          <li style={{ marginBottom: '0.4rem' }}>Chernobyl's long-term toll is genuinely debated; we show a range. Fukushima's larger figure (~2,314) is from the <em>evacuation</em>, not radiation — one death has been attributed to radiation.</li>
          <li>Nuclear's rate already includes Chernobyl and Fukushima. Even counted against it, it lands beside wind and solar.</li>
        </ul>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1.5rem', lineHeight: 1.6 }}>
        Figures from <a href="https://ourworldindata.org/safest-sources-of-energy" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)' }}>Our World in Data</a>{' '}
        (Markandya &amp; Wilkinson 2007; Sovacool et al. 2016), UNSCEAR, and IPCC AR5. Every number, with its source, is on{' '}
        <Link to="/sources" style={{ color: 'var(--color-brand)' }}>The Sources</Link>.
      </p>
    </section>
  )
}
