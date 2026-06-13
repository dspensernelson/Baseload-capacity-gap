import { useState } from 'react'
import Dispatch from '../components/Dispatch'

export default function Dispatches({ reports = [] }) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? null)
  const selected = reports.find(r => r.id === selectedId) ?? reports[0] ?? null

  return (
    <section style={{ maxWidth: '900px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Dispatches</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem', marginBottom: '2rem' }}>
        A plain-English monthly read on the U.S. nuclear fleet — what's running, what the NRC moved, where the
        gap stands. Written automatically from the data and published here on the 2nd of each month.
      </p>

      {!selected && (
        <p style={{ color: 'var(--color-text-muted)' }}>The first dispatch publishes shortly — check back on the 2nd.</p>
      )}

      {selected && (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 540px', minWidth: 0 }}>
            <Dispatch report={selected} />
          </div>

          {reports.length > 1 && (
            <div style={{ flex: '0 0 200px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>Archive</div>
              {reports.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: r.id === selected.id ? 'var(--color-surface)' : 'transparent',
                    border: 'none', borderLeft: `2px solid ${r.id === selected.id ? 'var(--color-brand)' : 'transparent'}`,
                    padding: '0.5rem 0.75rem', marginBottom: '0.15rem', fontFamily: 'var(--font-body)',
                    fontSize: '0.82rem', color: r.id === selected.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    fontWeight: r.id === selected.id ? 600 : 400,
                  }}
                >
                  {new Date(r.published_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
