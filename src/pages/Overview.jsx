import { Link } from 'react-router-dom'
import HeadlineBand from '../components/HeadlineBand'
import GapChart from '../components/GapChart'

export default function Overview({ gapSeries, headlines, demandSeries }) {
  return (
    <>
      {/* Hero: the chart IS the canvas — full bleed, edge to edge */}
      <GapChart gapSeries={gapSeries} headlines={headlines} demandSeries={demandSeries} />

      {/* Callouts: flush below the banner */}
      <HeadlineBand headlines={headlines} />

      <section style={{ maxWidth: '760px', marginTop: 'var(--spacing-section)', paddingBottom: '4rem', textAlign: 'center' }} className="centered">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1.7 }}>
          That gap is the whole story: capacity retiring faster than it's being replaced — narrowing only as the
          NRC approves license renewals. Below the headline, every reactor, its license history, and what the
          fleet is doing right now.
        </p>
        <Link
          to="/map"
          style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.6rem 1.4rem', background: 'var(--color-brand)', color: '#fff', borderRadius: '24px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}
        >
          Explore the map →
        </Link>
      </section>
    </>
  )
}
