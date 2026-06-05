function toGW(mw) {
  if (!mw) return '—'
  return (parseFloat(mw) / 1000).toFixed(1) + ' GW'
}

export default function HeadlineBand({ headlines }) {
  if (!headlines) return null

  return (
    <div style={{
      background: '#111827',
      color: '#fff',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      padding: '2rem 3rem',
    }}>
      <Stat
        value={toGW(headlines.operating_mw)}
        label="Operating Today"
        style={{ color: '#e2e8f0' }}
      />
      <Stat
        value={toGW(headlines.retiring_by_2035_mw)}
        label="Retiring by 2035"
        sublabel="The Gap"
        highlight
      />
      <Stat
        value={toGW(headlines.confirmed_pipeline_mw)}
        label="In the Pipeline"
        style={{ color: '#e2e8f0' }}
      />
    </div>
  )
}

function Stat({ value, label, sublabel, highlight, style }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', ...style }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: highlight ? '3.5rem' : '2.25rem',
        fontWeight: 900,
        lineHeight: 1,
        color: highlight ? 'var(--color-amber)' : undefined,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.7rem', color: 'var(--color-amber)', marginTop: '0.2rem', opacity: 0.85 }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}
