import GridMix from '../components/GridMix'

export default function Grid() {
  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">The Grid</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem' }}>
        Nuclear in context — not against wind and solar, but alongside them. The honest comparison is the most
        persuasive thing we can show: what each source actually contributes, hour by hour.
      </p>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '2.25rem', marginBottom: '0.4rem' }}>The 2 a.m. test</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Who actually keeps the lights on overnight? Here's the whole U.S. grid by source for the last two days.
        Watch solar vanish to zero every night while nuclear holds the same line around the clock.
      </p>
      <GridMix />

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2.5rem' }}>
        More comparisons coming here — including the "what would it take to replace this reactor?" math
        (the honest capacity-vs-energy exchange rate).
      </p>
    </section>
  )
}
