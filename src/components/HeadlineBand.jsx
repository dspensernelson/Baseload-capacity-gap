import { Link } from 'react-router-dom'

function toGW(mw) {
  if (!mw) return '—'
  return (parseFloat(mw) / 1000).toFixed(1) + ' GW'
}

export default function HeadlineBand({ headlines }) {
  if (!headlines) return null

  return (
    <div style={{
      borderBottom: '1px solid var(--color-border)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '1rem',
      padding: '1.5rem clamp(1rem, 4vw, 3rem)',
      background: 'var(--color-surface)',
    }}>
      <Stat
        value={toGW(headlines.operating_mw)}
        label="Operating Today"
        sourceKey="operating_mw"
      />
      <Stat
        value={toGW(headlines.retiring_by_2035_mw)}
        label="Retiring by 2035"
        highlight
        sourceKey="retiring_by_2035_mw"
      />
      <Stat
        value={toGW(headlines.confirmed_pipeline_mw)}
        label="In the Pipeline"
        sourceKey="pipeline_mw"
      />
    </div>
  )
}

function Stat({ value, label, highlight, sourceKey }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.25rem 1rem' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: highlight ? '2.75rem' : '2rem',
        fontWeight: 900,
        lineHeight: 1,
        color: highlight ? 'var(--color-amber)' : 'var(--color-brand)',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      {sourceKey && (
        <Link to={`/sources#${sourceKey}`} title="How this number is calculated and sourced"
          style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', textDecoration: 'none', opacity: 0.65 }}>
          source ↗
        </Link>
      )}
    </div>
  )
}
