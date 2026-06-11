function toGW(mw) {
  if (!mw) return '—'
  return (parseFloat(mw) / 1000).toFixed(1) + ' GW'
}

export default function HeadlineBand({ headlines }) {
  if (!headlines) return null

  return (
    <div style={{
      borderTop: '1px solid var(--color-border)',
      borderBottom: '1px solid var(--color-border)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      padding: '1.5rem 3rem',
      background: 'var(--color-surface)',
    }}>
      <Stat
        value={toGW(headlines.operating_mw)}
        label="Operating Today"
      />
      <Stat
        value={toGW(headlines.retiring_by_2035_mw)}
        label="Retiring by 2035"
        highlight
      />
      <Stat
        value={toGW(headlines.confirmed_pipeline_mw)}
        label="In the Pipeline"
      />
    </div>
  )
}

function Stat({ value, label, highlight }) {
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
    </div>
  )
}
