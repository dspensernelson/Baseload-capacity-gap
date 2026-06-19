import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../supabase'

// Public face of the audit trail: every number the site shows, what it means,
// exactly how it is computed, the primary source a skeptic can open, and when it
// was last reconciled. Rendered live from the metric_lineage registry, so it can
// never silently fall out of step with the numbers themselves.

const STATUS_CHIP = {
  pass:       { label: 'cross-checked', bg: 'rgba(45,106,79,0.12)',  fg: 'var(--color-operating)' },
  documented: { label: 'formula on file', bg: 'var(--color-surface)', fg: 'var(--color-text-muted)' },
  manual:     { label: 'assumption',    bg: 'var(--color-surface)',  fg: 'var(--color-text-muted)' },
  drift:      { label: 'needs attention', bg: 'rgba(193,71,42,0.14)', fg: 'var(--color-decommissioning)' },
}

// Coarse sections from the registry's sort_order bands.
const SECTIONS = [
  { min: 10, max: 19, title: 'The headline & the gap', sub: 'Overview' },
  { min: 20, max: 29, title: 'Every reactor',          sub: 'Map · reactor pages' },
  { min: 30, max: 39, title: 'The fleet',              sub: 'The Fleet' },
  { min: 40, max: 49, title: 'The grid',               sub: 'The Grid' },
  { min: 50, max: 59, title: 'What-if scenarios',      sub: 'Scenarios' },
  { min: 60, max: 63, title: 'Safety & emissions',     sub: 'Safety' },
  { min: 64, max: 69, title: 'History',                sub: 'History' },
  { min: 70, max: 99, title: 'Definitions',            sub: 'Methodology' },
]

function fmtDate(s) {
  if (!s) return null
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtVal(v, unit) {
  const n = parseFloat(v)
  if (isNaN(n)) return v
  if (unit === 'MW') return Math.round(n).toLocaleString() + ' MW'
  if (unit === 'GW') return n.toFixed(1) + ' GW'
  return v
}

export default function Sources() {
  const [metrics, setMetrics] = useState([])
  const [lastRun, setLastRun] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('metric_lineage').select('*').order('sort_order'),
      supabase.from('reconciliation_log').select('run_at, status').order('run_at', { ascending: false }).limit(30),
    ]).then(([{ data: m }, { data: log }]) => {
      if (!alive) return
      setMetrics(m ?? [])
      if (log && log.length) {
        const latest = log[0].run_at
        const sameRun = log.filter(r => r.run_at === latest)
        setLastRun({ at: latest, allPass: sameRun.every(r => r.status === 'pass'), count: sameRun.length })
      }
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  // Deep-link support: scroll to the anchored metric (e.g. /sources#operating_mw).
  useEffect(() => {
    if (loaded && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loaded])

  const sections = useMemo(() => SECTIONS.map(s => ({
    ...s,
    rows: metrics.filter(m => m.sort_order >= s.min && m.sort_order <= s.max),
  })).filter(s => s.rows.length), [metrics])

  return (
    <section style={{ maxWidth: '900px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">How we know every number</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem', lineHeight: 1.65 }}>
        Every figure on this site traces to a public primary source and a written formula — nothing is hand-typed
        or taken on faith. A job re-derives each headline number from the underlying reactor records every week and
        compares it to what you see here; if anything ever stops matching its source, it gets flagged automatically.
      </p>

      {loaded && lastRun && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.25rem',
          padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
          background: lastRun.allPass ? 'rgba(45,106,79,0.10)' : 'rgba(193,71,42,0.12)',
          color: lastRun.allPass ? 'var(--color-operating)' : 'var(--color-decommissioning)',
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: '1rem' }}>{lastRun.allPass ? '✓' : '⚠'}</span>
          {lastRun.allPass
            ? <span>Last reconciled <strong>{fmtDate(lastRun.at)}</strong> — every headline traced back to its source.</span>
            : <span>Last reconciliation on {fmtDate(lastRun.at)} flagged a discrepancy — under review.</span>}
        </div>
      )}

      <div style={{ marginTop: '2.5rem', padding: '1.25rem 1.4rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--color-brand)', marginTop: 0, marginBottom: '0.75rem' }}>
          How to read these numbers
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--color-text)' }}>A snapshot, not a forecast.</strong> This is committed reality today, not a prediction.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--color-text)' }}>Retirements use NRC license-expiration dates, and we never assume a renewal until the NRC approves it.</strong> So "retiring by 2035" is an upper bound — every approved renewal shrinks it. History says nearly all reactors renew; explore that on <Link to="/scenarios" style={{ color: 'var(--color-brand)' }}>Scenarios</Link>.</li>
          <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--color-text)' }}>"Confirmed" vs "speculative" pipeline.</strong> Confirmed = under construction or holding a construction permit/license; speculative = announced and engaging regulators but no construction license (excluded from the headline pipeline number).</li>
          <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--color-text)' }}>Capacity is EIA nameplate</strong> — about 5% above net-summer capacity; both are correct (see "Nameplate vs net-summer" below).</li>
          <li><strong style={{ color: 'var(--color-text)' }}>What it does not model:</strong> unannounced renewals, policy shifts, grid-demand changes, or projects cancelled after the data was compiled.</li>
        </ul>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{ marginTop: '2.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--color-brand)', marginBottom: '0.15rem' }}>
            {section.title}
          </h3>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            {section.sub}
          </div>

          {section.rows.map(m => {
            const chip = STATUS_CHIP[m.reconcile_status] ?? STATUS_CHIP.documented
            const verified = fmtDate(m.last_reconciled_at)
            return (
              <div id={m.metric_key} key={m.metric_key} style={{
                border: '1px solid var(--color-border)', borderRadius: '10px',
                padding: '1rem 1.2rem', marginBottom: '0.85rem', background: '#fff', scrollMarginTop: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                    {m.label}
                    {m.last_value && (
                      <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                        now {fmtVal(m.last_value, m.unit)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.18rem 0.55rem', borderRadius: '999px', background: chip.bg, color: chip.fg, whiteSpace: 'nowrap' }}>
                    {chip.label}
                  </span>
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '0.45rem', lineHeight: 1.55 }}>
                  {m.definition}
                </div>

                <div style={{
                  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                  fontSize: '0.78rem', color: 'var(--color-text)', background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)', borderRadius: '6px',
                  padding: '0.5rem 0.7rem', marginTop: '0.6rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.formula}
                </div>

                {m.constants && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                    <strong>Constants:</strong> {m.constants}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                  <a href={m.primary_source_url} target="_blank" rel="noreferrer"
                     style={{ fontSize: '0.82rem', color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>
                    Source: {m.primary_source} ↗
                  </a>
                  {verified && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      last checked {verified}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2.5rem', lineHeight: 1.6 }}>
        Every dataset behind these numbers is downloadable, free, on{' '}
        <Link to="/data" style={{ color: 'var(--color-brand)' }}>The Data</Link>.
      </p>
    </section>
  )
}
