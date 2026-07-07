import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import SignupForm from '../components/SignupForm'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Render the digest's markdown body (## headings, - bullets, paragraphs) as JSX.
function DigestBody({ body }) {
  const blocks = useMemo(() => {
    const out = []
    let list = null
    for (const raw of (body || '').split('\n')) {
      const line = raw.trim()
      if (line.startsWith('## ')) {
        if (list) { out.push({ type: 'ul', items: list }); list = null }
        out.push({ type: 'h', text: line.slice(3).trim() })
      } else if (line.startsWith('- ')) {
        ;(list ??= []).push(line.slice(2).trim())
      } else if (!line) {
        if (list) { out.push({ type: 'ul', items: list }); list = null }
      } else {
        if (list) { out.push({ type: 'ul', items: list }); list = null }
        out.push({ type: 'p', text: line })
      }
    }
    if (list) out.push({ type: 'ul', items: list })
    return out
  }, [body])

  return (
    <div>
      {blocks.map((b, i) => {
        if (b.type === 'h') return <h3 key={i} style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--color-brand)', marginTop: '1.6rem', marginBottom: '0.5rem' }}>{b.text}</h3>
        if (b.type === 'ul') return <ul key={i} style={{ margin: '0.3rem 0', paddingLeft: '1.2rem' }}>{b.items.map((it, j) => <li key={j} style={{ margin: '0.3rem 0', lineHeight: 1.5 }}>{it}</li>)}</ul>
        return <p key={i} style={{ margin: '0.7rem 0', lineHeight: 1.6 }}>{b.text}</p>
      })}
    </div>
  )
}

export default function Newsletter({ reports = [] }) {
  const { period } = useParams()
  const issues = useMemo(
    () => reports.filter(r => r.kind === 'weekly_news').sort((a, b) => (b.period ?? '').localeCompare(a.period ?? '')),
    [reports],
  )
  const issue = period ? issues.find(r => r.period === period) : null

  useEffect(() => {
    document.title = issue
      ? `${issue.title} · Baseload`
      : 'Newsletter · Baseload'
  }, [issue])

  // Single-issue view.
  if (period) {
    if (!issue) {
      return (
        <section style={{ maxWidth: '720px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
          <h2 className="section-title">Issue not found</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            <Link to="/newsletter" style={{ color: 'var(--color-brand)' }}>← All issues</Link>
          </p>
        </section>
      )
    }
    return (
      <section style={{ maxWidth: '720px', marginTop: '2.5rem', paddingBottom: '4rem' }} className="centered">
        <Link to="/newsletter" style={{ fontSize: '0.85rem', color: 'var(--color-brand)', textDecoration: 'none' }}>← All issues</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-brand)', marginTop: '1rem', lineHeight: 1.15 }}>{issue.title}</h1>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{fmtDate(issue.published_at)}</div>
        <DigestBody body={issue.body} />
        <div style={{ marginTop: '2.5rem' }}>
          <SignupForm source="newsletter-issue" />
        </div>
      </section>
    )
  }

  // Archive index.
  return (
    <section style={{ maxWidth: '760px', marginTop: '2.5rem', paddingBottom: '4rem' }} className="centered">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 900, color: 'var(--color-brand)', lineHeight: 1.1 }}>The Newswire</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
        A weekly digest of the highest-signal power-sector stories.{' '}
        <a href="/newsletter.xml" style={{ color: 'var(--color-brand)' }}>RSS</a>
      </p>

      <SignupForm source="newsletter-archive" />

      <div style={{ marginTop: '2rem', display: 'grid', gap: '0.8rem' }}>
        {issues.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No issues published yet — check back soon.</p>}
        {issues.map(it => (
          <Link
            key={it.period}
            to={`/newsletter/${it.period}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: '0.85rem 1rem', border: '1px solid var(--color-border)', borderRadius: '9px' }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{fmtDate(it.published_at)} · {it.period}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', marginTop: '0.2rem' }}>{it.title}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}
