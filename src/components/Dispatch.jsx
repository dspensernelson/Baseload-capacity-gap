// Renders an agent-written dispatch from the `reports` table. Tiny markdown
// subset (##, **bold**, ---, _italic_, paragraphs) — no dependency, since we
// control the source format.

function renderInline(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    return m
      ? <strong key={`${keyBase}-${i}`} style={{ color: 'var(--color-text)' }}>{m[1]}</strong>
      : <span key={`${keyBase}-${i}`}>{p}</span>
  })
}

function MarkdownLite({ md }) {
  return md.trim().split(/\n\n+/).map((block, i) => {
    const t = block.trim()
    if (t === '---')
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '1.25rem 0' }} />
    if (t.startsWith('## '))
      return <h3 key={i} style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--color-brand)', margin: '1.25rem 0 0.5rem' }}>{renderInline(t.slice(3), i)}</h3>
    if (t.startsWith('_') && t.endsWith('_'))
      return <p key={i} style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>{renderInline(t.slice(1, -1), i)}</p>
    return <p key={i} style={{ marginBottom: '0.6rem', color: 'var(--color-text)' }}>{renderInline(t, i)}</p>
  })
}

export default function Dispatch({ report }) {
  if (!report) return null
  const date = new Date(report.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.5rem 1.75rem', lineHeight: 1.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
        <span className="pulse-dot" style={{ width: 7, height: 7 }} />
        Monthly Dispatch · auto-generated · {date}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-brand)', marginBottom: '0.25rem' }}>
        {report.title}
      </div>
      <MarkdownLite md={report.body} />
    </div>
  )
}
