import GridMix from '../components/GridMix'
import WholesalePrices from '../components/WholesalePrices'
import ReplacementMath from '../components/ReplacementMath'

export default function Grid({ reactors = [] }) {
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

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>The price of intermittency</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Same story, in dollars. Wholesale electricity price swings hour to hour with how much solar and wind are on the
        grid — a cost that flat, predictable output doesn't carry. Pilot: California (CAISO) only.
      </p>
      <WholesalePrices />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>What would it take to replace one?</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '46rem' }}>
        Capacity and energy aren't the same thing. Here's the honest exchange rate between a reactor and the wind or
        solar it would take to match its output over a year.
      </p>
      <ReplacementMath reactors={reactors} />
    </section>
  )
}
