import GapChart from '../components/GapChart'

// Chrome-free, iframe-embeddable version of the signature gap chart.
export default function EmbedGap({ gapSeries, headlines }) {
  return (
    <div>
      <GapChart gapSeries={gapSeries} headlines={headlines} />
      <div style={{ textAlign: 'center', fontSize: '0.7rem', padding: '0.45rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
        <a href="https://nukemap-two.vercel.app" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>
          Nuclear Pipeline Tracker →
        </a>
      </div>
    </div>
  )
}
