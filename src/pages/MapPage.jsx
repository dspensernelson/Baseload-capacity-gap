import Hook from '../components/Hook'
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

export default function MapPage({ reactors, filteredReactors, projects, licenseActionsByReactor, selectedISO, setSelectedISO }) {
  return (
    <section style={{ maxWidth: '1400px', marginTop: '2.5rem', paddingBottom: '5rem' }} className="centered">
      <h2 className="section-title">Every Reactor</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem', maxWidth: '46rem' }}>
        Every U.S. power reactor, colored by status, sized by capacity. Hollow rings are units offline for refueling;
        blue pins are new build and restarts in the pipeline. Click any reactor — on the map or in the table — for its full page.
      </p>
      <ISOFilterBar reactors={reactors} selectedISO={selectedISO} setSelectedISO={setSelectedISO} />
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <Hook reactors={filteredReactors} projects={projects} setSelectedISO={setSelectedISO} licenseActionsByReactor={licenseActionsByReactor} />
        </div>
        <div style={{ flex: '1 1 340px', minWidth: 0, height: '600px' }}>
          <ReactorTable reactors={filteredReactors} />
        </div>
      </div>
    </section>
  )
}
