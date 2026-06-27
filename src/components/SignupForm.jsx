import { useState } from 'react'

// Email capture for the weekly newswire. POSTs to /api/subscribe, which inserts
// into the subscribers table via an insert-only RLS policy. Compact by default
// so it can sit on the News page, Overview, or in a footer.
export default function SignupForm({ source = 'web', compact = false, heading = 'Get the weekly newswire' }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [message, setMessage] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setMessage('')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setMessage(data.error || 'Something went wrong. Please try again.')
        return
      }
      setState('done')
      setMessage(data.message || "You're on the list.")
      setEmail('')
    } catch {
      setState('error')
      setMessage('Network error. Please try again.')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ padding: compact ? '0.6rem 0' : '1rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)' }}>
        <strong style={{ color: 'var(--color-operating)' }}>✓ {message}</strong>
      </div>
    )
  }

  return (
    <div style={{ padding: compact ? '0.85rem 1rem' : '1.15rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)' }}>
      {heading && (
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-brand)', fontSize: compact ? '0.98rem' : '1.1rem' }}>
          {heading}
        </div>
      )}
      <p style={{ margin: '0.3rem 0 0.7rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        The top power-sector stories, once a week. No spam.
      </p>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          style={{ flex: '1 1 180px', minWidth: 0, padding: '0.5rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: '7px', fontSize: '0.9rem' }}
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          style={{ border: '1px solid var(--color-brand)', background: 'var(--color-brand)', color: '#fff', borderRadius: '7px', padding: '0.5rem 1rem', fontSize: '0.88rem', fontWeight: 600, cursor: state === 'sending' ? 'default' : 'pointer', opacity: state === 'sending' ? 0.7 : 1 }}
        >
          {state === 'sending' ? 'Joining…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && (
        <p style={{ margin: '0.55rem 0 0', color: 'var(--color-decommissioning)', fontSize: '0.82rem' }}>{message}</p>
      )}
    </div>
  )
}
