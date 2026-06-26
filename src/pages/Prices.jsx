import WholesalePrices from '../components/WholesalePrices'

export default function Prices() {
  return (
    <section style={{ maxWidth: '1100px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Wholesale Prices</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem', marginBottom: '1.25rem' }}>
        The same grid story, in dollars. This view tracks hourly wholesale power prices so volatility is visible
        rather than abstract.
      </p>

      <WholesalePrices />
    </section>
  )
}
