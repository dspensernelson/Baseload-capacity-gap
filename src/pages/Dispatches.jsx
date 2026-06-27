import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
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

function WeeklyDigest({ report }) {
  if (!report) return null
  const lines = report.body.split('\n').filter(Boolean)
  return (
    <div style={{
      marginBottom: '1.75rem', padding: '0.9rem 1.1rem', borderRadius: '8px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
        This week · {new Date(report.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      {lines.map((line, i) => (
        <p key={i} style={{ fontSize: '0.88rem', margin: i === 0 ? 0 : '0.4rem 0 0' }}>{line}</p>
      ))}
    </div>
  )
}

function NewswireDigest({ report }) {
  if (!report) return null
  const stories = Array.isArray(report?.stats?.stories) ? report.stats.stories : []
  if (!stories.length) return null

  return (
    <div style={{ marginTop: '3.25rem' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-brand)', marginBottom: '0.3rem' }}>Newswire</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.1rem', maxWidth: '46rem' }}>
        Weekly top-line digest from free public nuclear feeds, auto-ranked and published.
      </p>

      <div style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>
          Week of {new Date(report.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' · '}
          {report?.stats?.claude_used ? 'Claude-assisted lead' : 'Deterministic lead'}
        </div>
        <p style={{ margin: 0, fontSize: '0.88rem' }}>{(report.body || '').split('\n')[0]}</p>
      </div>

      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {stories.map((s, i) => (
          <a
            key={`${s.link}-${i}`}
            href={s.link}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              borderRadius: '8px',
              padding: '0.7rem 0.85rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
              {s.source} · {new Date(s.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.45 }}>{s.title}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function RegulatoryRadar({ actions, reactorsById, digest }) {
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
        What's moving at the NRC — license renewals and 80-year extensions, straight from the records. Updates weekly.
      </p>
      <WeeklyDigest report={digest} />
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
  const { period } = useParams()
  const monthlyReports = useMemo(() => reports.filter(r => r.kind === 'monthly'), [reports])
  const radarDigest = useMemo(() => reports.find(r => r.kind === 'weekly_radar') ?? null, [reports])
  const newswireDigest = useMemo(() => reports.find(r => r.kind === 'weekly_news') ?? null, [reports])
  const selected = (period ? monthlyReports.find(r => r.period === period) : null) ?? monthlyReports[0] ?? null
  const reactorsById = useMemo(
    () => Object.fromEntries(reactors.map(r => [r.id, `${r.plant_name} ${r.unit_number}`])),
    [reactors])

  useEffect(() => {
    if (selected) document.title = `${selected.title} · Nuclear Pipeline Tracker`
  }, [selected])

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

          {monthlyReports.length > 1 && (
            <div style={{ flex: '0 0 200px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>Archive</div>
              {monthlyReports.map(r => (
                <Link
                  key={r.id}
                  to={`/dispatches/${r.period}`}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', textDecoration: 'none',
                    background: r.id === selected.id ? 'var(--color-surface)' : 'transparent',
                    borderLeft: `2px solid ${r.id === selected.id ? 'var(--color-brand)' : 'transparent'}`,
                    padding: '0.5rem 0.75rem', marginBottom: '0.15rem', fontFamily: 'var(--font-body)',
                    fontSize: '0.82rem', color: r.id === selected.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    fontWeight: r.id === selected.id ? 600 : 400,
                  }}
                >
                  {new Date(r.published_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <RegulatoryRadar actions={licenseActions} reactorsById={reactorsById} digest={radarDigest} />
      <NewswireDigest report={newswireDigest} />
    </section>
  )
}
