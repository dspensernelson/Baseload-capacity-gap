import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import supabase from '../supabase'

// "Incidents" — the live NRC Event Notification wire (scraped daily into `incidents`),
// with the cross-source safety comparison kept below as "the bigger picture" context.

const SEV = {
  'GENERAL EMERGENCY':             { bg: 'rgba(140,47,29,0.20)', fg: '#8c2f1d' },
  'SITE AREA EMERGENCY':           { bg: 'rgba(176,74,50,0.16)', fg: '#a23b2d' },
  'ALERT':                         { bg: 'rgba(217,130,43,0.16)', fg: '#b5651d' },
  'NOTIFICATION OF UNUSUAL EVENT': { bg: 'rgba(217,130,43,0.10)', fg: '#9c6a1d' },
}
const NEUTRAL = { bg: 'var(--color-surface)', fg: 'var(--color-text-muted)' }
const sevOf = ec => SEV[(ec || '').toUpperCase()] || NEUTRAL

const CAT_COLOR = { combustion: '#b04a32', clean: '#3a8a5f' }
const colorFor = d => (d.energy_source === 'Nuclear' ? '#1d3557' : CAT_COLOR[d.category] || '#999')

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Incidents() {
  const [events, setEvents] = useState([])
  const [safety, setSafety] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [cls, setCls] = useState('all')

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('incidents').select('*').order('event_date', { ascending: false, nullsFirst: false }).limit(200),
      supabase.from('energy_safety').select('*').order('sort_order'),
    ]).then(([{ data: ev }, { data: s }]) => {
      if (!alive) return
      setEvents(ev ?? [])
      setSafety((s ?? []).map(d => ({ ...d, deaths_per_twh: parseFloat(d.deaths_per_twh) })))
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  const classes = useMemo(() => [...new Set(events.map(e => e.emergency_class).filter(Boolean))], [events])
  const shown = useMemo(() => events.filter(e => {
    if (cls !== 'all' && (e.emergency_class || '') !== cls) return false
    if (q && !`${e.facility} ${e.description} ${e.emergency_class}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [events, q, cls])

  const coal = safety.find(d => d.energy_source === 'Coal')
  const nuclear = safety.find(d => d.energy_source === 'Nuclear')
  const ratio = coal && nuclear ? Math.round(coal.deaths_per_twh / nuclear.deaths_per_twh) : null

  return (
    <section style={{ maxWidth: '1000px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Incidents</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1.7, maxWidth: '46rem' }}>
        Nuclear is the most transparent energy source there is. When anything happens at a U.S. plant — a reactor
        trip, an unusual event, a fire, a security or medical call — the operator is required to notify the NRC, and
        it's posted publicly. This is that wire, pulled in daily and unedited. Most of it is routine. That's the point.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', margin: '1.5rem 0 1rem' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search plant or text…"
          style={{ flex: '1 1 220px', padding: '0.45rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }} />
        <select value={cls} onChange={e => setCls(e.target.value)}
          style={{ padding: '0.45rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'var(--font-body)', background: '#fff' }}>
          <option value="all">All event types</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{shown.length} shown</span>
      </div>

      {loaded && events.length === 0 && (
        <div style={{ border: '1px dashed var(--color-border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          No event notifications ingested yet — the daily NRC scraper populates this feed, and the first report lands at the next run.
        </div>
      )}

      <div>
        {shown.map(e => {
          const s = sevOf(e.emergency_class)
          const isSample = String(e.event_number).startsWith('SAMPLE')
          return (
            <div key={e.event_number} style={{ border: '1px solid var(--color-border)', borderLeft: `3px solid ${s.fg}`, borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '0.75rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>
                  {e.facility || 'Unknown facility'}
                  {e.unit ? <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}> · Unit {e.unit}</span> : null}
                </div>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.15rem 0.5rem', borderRadius: '999px', background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>
                  {e.emergency_class || 'event'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                {fmtDate(e.event_date || e.report_date)}
                {e.state ? ` · ${e.state}` : ''}{e.rx_type ? ` · ${e.rx_type}` : ''}
                {!isSample && e.event_number ? ` · EN #${e.event_number}` : ''}
              </div>
              {e.description && (
                <div style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginTop: '0.5rem', lineHeight: 1.5 }}>{e.description}</div>
              )}
              {e.notification_basis && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>Reported under {e.notification_basis}</div>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>
        Source: <a href="https://www.nrc.gov/reading-rm/doc-collections/event-status/event/index" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)' }}>NRC Event Notification Reports</a>, refreshed daily. Every field is on <Link to="/sources" style={{ color: 'var(--color-brand)' }}>The Sources</Link>.
      </p>

      {safety.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>Step back: how dangerous is all this, really?</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem', maxWidth: '46rem' }}>
            Events happen constantly — and nuclear still has among the lowest death rates of any energy source, once you
            count the quiet toll of air pollution alongside the dramatic accidents. Deaths per TWh of electricity:
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={safety} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis type="category" dataKey="energy_source" width={92} tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: 'var(--color-text)' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={v => [`${v} deaths/TWh`, 'Death rate']} />
              <Bar dataKey="deaths_per_twh" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {safety.map(d => <Cell key={d.energy_source} fill={colorFor(d)} />)}
                <LabelList dataKey="deaths_per_twh" position="right" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-text)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {ratio && (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.75rem', maxWidth: '46rem', lineHeight: 1.6 }}>
              Per unit of energy, coal kills around <strong style={{ color: '#b04a32' }}>{ratio.toLocaleString()}×</strong> as
              many people as nuclear — mostly through air pollution that never makes a headline. Full figures and sources on{' '}
              <Link to="/sources" style={{ color: 'var(--color-brand)' }}>The Sources</Link>.
            </p>
          )}
        </>
      )}
    </section>
  )
}
