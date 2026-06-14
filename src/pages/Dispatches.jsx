import { useState, useMemo } from 'react'
import Dispatch from '../components/Dispatch'

const ACTION_LABELS = {
  license_renewal: 'License renewal',
  subsequent_license_renewal: '80-year extension (SLR)',
  restart_authorization: 'Restart authorization',
}
const yr = d => (d ? new Date(d).getFullYear() : null)

function RadarLine({ a, name }) {
  const pending = a.status === 'under_review'
  const label = ACTION_LABELS[a.action_type] ?? a.action_type?.replace(/_/g, ' ')
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
      <span style={{ color: pending ? 'var(--color-amber)' : 'var(--color-operating)' }}>{pending ? '⏳' : '✓'}</span>
      <div>
        <strong>{name}</strong> — {label}{' '}
        <span style={{ color: 'var(--color-text-muted)' }}>
          {pending
            ? `under review${yr(a.action_date) ? ` (filed ${yr(a.action_date)})` : ''}`
            : `${yr(a.action_date) ?? ''}${yr(a.new_expiration_date) ? ` → licensed to ${yr(a.new_expiration_date)}` : ''}`}
        </span>
      </div>
    </div>
  )
}

function RegulatoryRadar({ actions, reactorsById }) {
  const nameOf = a =>
    (a.reactor_id && reactorsById[a.reactor_id])
      ? reactorsById[a.reactor_id]
      : (a.notes ? a.notes.split('—')[0].trim().slice(0, 36) : '—')

  const pending = useMemo(
    () => actions.filter(a => a.status === 'under_review')
      .sort((a, b) => (b.action_date || '').localeCompare(a.action_date || '')),
    [actions])
  const issued = useMemo(
    () => actions.filter(a => a.status === 'approved' && a.action_date)
      .sort((a, b) => (b.action_date || '').localeCompare(a.action_date || '')).slice(0, 8),
    [actions])

  if (!actions.length) return null

  return (
    <div style={{ marginTop: '3.5rem' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-brand)', marginBottom: '0.3rem' }}>Regulatory radar</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '46rem' }}>
        What's moving at the NRC — license renewals and 80-year extensions, straight from the records. Updates monthly.
      </p>
      <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-amber)', marginBottom: '0.5rem' }}>Under NRC review ({pending.length})</div>
          {pending.length ? pending.map(a => <RadarLine key={a.id} a={a} name={nameOf(a)} />)
            : <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nothing pending.</div>}
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-operating)', marginBottom: '0.5rem' }}>Recently issued</div>
          {issued.map(a => <RadarLine key={a.id} a={a} name={nameOf(a)} />)}
        </div>
      </div>
    </div>
  )
}

export default function Dispatches({ reports = [], licenseActions = [], reactors = [] }) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? null)
  const selected = reports.find(r => r.id === selectedId) ?? reports[0] ?? null
  const reactorsById = useMemo(
    () => Object.fromEntries(reactors.map(r => [r.id, `${r.plant_name} ${r.unit_number}`])),
    [reactors])

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

      <RegulatoryRadar actions={licenseActions} reactorsById={reactorsById} />
    </section>
  )
}
