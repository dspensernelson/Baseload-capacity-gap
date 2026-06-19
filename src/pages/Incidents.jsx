import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Incidents() {
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [cls, setCls] = useState('all')

  useEffect(() => {
    let alive = true
    supabase.from('incidents').select('*').order('event_date', { ascending: false, nullsFirst: false }).limit(200)
      .then(({ data: ev }) => {
        if (!alive) return
        setEvents(ev ?? [])
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
        Source: <a href="https://www.nrc.gov/reading-rm/doc-collections/event-status/event/index" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)' }}>NRC Event Notification Reports</a>, refreshed daily. Every field is on <Link to="/sources" style={{ color: 'var(--color-brand)' }}>The Sources</Link>. Wondering how risky any of this really is? See <Link to="/safety" style={{ color: 'var(--color-brand)' }}>Safety</Link>.
      </p>
    </section>
  )
}
