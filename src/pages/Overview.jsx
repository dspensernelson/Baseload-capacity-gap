import HeadlineBand from '../components/HeadlineBand'
import Hook from '../components/Hook'
import GapChart from '../components/GapChart'
import ReactorTable from '../components/ReactorTable'

const ISO_LABELS = {
  PJM:  'PJM',
  MISO: 'MISO',
  ERCO: 'ERCOT',
  CISO: 'CAISO',
  NYIS: 'NYISO',
  ISNE: 'ISO-NE',
  SWPP: 'SPP',
  TVA:  'TVA',
  SOCO: 'SOCO',
  DUK:  'Duke',
  CPLE: 'Duke Progress',
  FPL:  'FPL',
  SRP:  'SRP',
  BPAT: 'BPA',
  SCEG: 'SCEG',
}

function ISOFilterBar({ reactors, selectedISO, setSelectedISO }) {
  const counts = {}
  reactors.forEach(r => { if (r.iso_rto) counts[r.iso_rto] = (counts[r.iso_rto] || 0) + 1 })

  const pills = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, label: ISO_LABELS[code] ?? code, count }))

  const btnBase = {
    padding: '0.3rem 0.75rem', borderRadius: '20px', border: '1.5px solid var(--color-border)',
    fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
    fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>Filter by ISO/RTO:</span>
      <button
        onClick={() => setSelectedISO(null)}
        style={{ ...btnBase, background: !selectedISO ? 'var(--color-brand)' : '#fff', color: !selectedISO ? '#fff' : 'var(--color-text)', borderColor: !selectedISO ? 'var(--color-brand)' : 'var(--color-border)' }}
      >
        All
      </button>
      {pills.map(({ code, label, count }) => (
        <button
          key={code}
          onClick={() => setSelectedISO(selectedISO === code ? null : code)}
          style={{ ...btnBase, background: selectedISO === code ? 'var(--color-brand)' : '#fff', color: selectedISO === code ? '#fff' : 'var(--color-text)', borderColor: selectedISO === code ? 'var(--color-brand)' : 'var(--color-border)' }}
        >
          {label} <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>{count}</span>
        </button>
      ))}
    </div>
  )
}

export default function Overview({
  gapSeries, headlines, reactors, filteredReactors,
  licenseActionsByReactor, selectedISO, setSelectedISO,
}) {
  return (
    <>
      {/* Hero: the chart IS the canvas — full bleed, edge to edge */}
      <GapChart gapSeries={gapSeries} headlines={headlines} />

      {/* Callouts: flush below the banner */}
      <HeadlineBand headlines={headlines} />

      {/* Map + Table side by side */}
      <section style={{ maxWidth: '1400px', marginTop: 'var(--spacing-section)', paddingBottom: '5rem' }} className="centered">
        <ISOFilterBar reactors={reactors} selectedISO={selectedISO} setSelectedISO={setSelectedISO} />
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 58%', minWidth: 0 }}>
            <Hook reactors={filteredReactors} setSelectedISO={setSelectedISO} licenseActionsByReactor={licenseActionsByReactor} />
          </div>
          <div style={{ flex: 1, minWidth: 0, height: '600px' }}>
            <ReactorTable reactors={filteredReactors} />
          </div>
        </div>
      </section>
    </>
  )
}
