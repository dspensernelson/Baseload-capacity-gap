import GridMix from '../components/GridMix'
import ReliabilityProfile from '../components/ReliabilityProfile'
import FirmingSnapshot from '../components/FirmingSnapshot'
import DemandGrowth from '../components/DemandGrowth'
import ReplacementMath from '../components/ReplacementMath'

export default function Grid({ reactors = [], demandSeries = [] }) {
  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">The Grid</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem' }}>
        Nuclear in context — not against wind and solar, but alongside them. The honest comparison is the most
        persuasive thing we can show: what each source actually contributes, hour by hour.
      </p>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '2.25rem', marginBottom: '0.4rem' }}>Generation: the 2 a.m. test</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Who actually keeps the lights on overnight? Here's the whole U.S. grid by source for the last two days.
        Watch solar vanish to zero every night while nuclear holds the same line around the clock.
      </p>
      <GridMix />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>Reliability, source by source</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        This is the whole system, not just one chart window: how much each source swings over time, and how hard each one ramps.
        Lower volatility means less balancing pressure elsewhere on the grid.
      </p>
      <ReliabilityProfile />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>How nuclear firms the grid</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Firming isn't a slogan; it is measurable behavior during hard hours. When solar is absent and wind is weak,
        this shows how much of the system nuclear still carries.
      </p>
      <FirmingSnapshot />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>Why this gets harder, not easier</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '46rem' }}>
        Demand stopped being flat. Data centers, electrification, and onshoring are pushing nationwide electricity
        use up for the first time in two decades — raising the stakes on everything above.
      </p>
      <DemandGrowth demandSeries={demandSeries} />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-brand)', marginTop: '3rem', marginBottom: '0.4rem' }}>What would it take to replace one?</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '46rem' }}>
        Capacity and energy aren't the same thing. Here's the honest exchange rate between a reactor and the wind or
        solar it would take to match its output over a year.
      </p>
      <ReplacementMath reactors={reactors} />
    </section>
  )
}
