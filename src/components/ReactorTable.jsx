import { useState, useMemo } from 'react'

const STATUS_COLORS = {
  operating:       { bg: '#d1fae5', color: '#065f46' },
  license_renewed: { bg: '#d1fae5', color: '#065f46' },
  decommissioning: { bg: '#fee2e2', color: '#991b1b' },
  shutdown:        { bg: '#f3f4f6', color: '#374151' },
}

const CURRENT_YEAR = new Date().getFullYear()

function fmtYear(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).getFullYear()
}

function fmtMW(mw) {
  if (!mw) return '—'
  return parseFloat(mw).toLocaleString() + ' MW'
}

export default function ReactorTable({ reactors }) {
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [stateFilter,   setStateFilter]   = useState('all')
  const [operatorQuery, setOperatorQuery] = useState('')
  const [expiryBefore,  setExpiryBefore]  = useState('all')
  const [sortCol,       setSortCol]       = useState('capacity_mw')
  const [sortDir,       setSortDir]       = useState('desc')

  const states = useMemo(() =>
    [...new Set(reactors.map(r => r.state).filter(Boolean))].sort(),
  [reactors])

  const filtered = useMemo(() => {
    let rows = reactors

    if (statusFilter !== 'all')
      rows = rows.filter(r => r.status === statusFilter)

    if (stateFilter !== 'all')
      rows = rows.filter(r => r.state === stateFilter)

    if (operatorQuery.trim())
      rows = rows.filter(r => r.operator?.toLowerCase().includes(operatorQuery.toLowerCase()))

    if (expiryBefore !== 'all') {
      const yr = parseInt(expiryBefore)
      rows = rows.filter(r => r.license_expiration_date && new Date(r.license_expiration_date).getFullYear() <= yr)
    }

    return [...rows].sort((a, b) => {
      let av = a[sortCol] ?? ''
      let bv = b[sortCol] ?? ''
      if (sortCol === 'capacity_mw') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0 }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [reactors, statusFilter, stateFilter, operatorQuery, expiryBefore, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const Th = ({ col, children }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', borderBottom: '2px solid var(--color-border)' }}
    >
      {children} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'all', label: 'All statuses' },
          { value: 'operating', label: 'Operating' },
          { value: 'shutdown', label: 'Shutdown' },
          { value: 'decommissioning', label: 'Decommissioning' },
          { value: 'license_renewed', label: 'License renewed' },
        ]} />

        <Select label="State" value={stateFilter} onChange={setStateFilter} options={[
          { value: 'all', label: 'All states' },
          ...states.map(s => ({ value: s, label: s })),
        ]} />

        <Select label="License expiry" value={expiryBefore} onChange={setExpiryBefore} options={[
          { value: 'all',   label: 'Any expiry' },
          { value: '2030',  label: 'Before 2030' },
          { value: '2035',  label: 'Before 2035' },
          { value: '2040',  label: 'Before 2040' },
        ]} />

        <input
          type="text"
          placeholder="Search operator…"
          value={operatorQuery}
          onChange={e => setOperatorQuery(e.target.value)}
          style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.85rem', fontFamily: 'var(--font-body)', width: '180px' }}
        />

        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {filtered.length} reactor{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <Th col="state">State</Th>
              <Th col="plant_name">Plant</Th>
              <Th col="unit_number">Unit</Th>
              <Th col="operator">Operator</Th>
              <Th col="capacity_mw">Capacity</Th>
              <Th col="commercial_operation_date">Commercial op.</Th>
              <Th col="license_expiration_date">License exp.</Th>
              <Th col="status">Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const chip = STATUS_COLORS[r.status] ?? STATUS_COLORS.shutdown
              const expYear = r.license_expiration_date ? new Date(r.license_expiration_date).getFullYear() : null
              const expiring = expYear && expYear <= CURRENT_YEAR + 10
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--color-surface)' }}>
                  <td style={td}>{r.state}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{r.plant_name}</td>
                  <td style={td}>{r.unit_number}</td>
                  <td style={{ ...td, color: 'var(--color-text-muted)' }}>{r.operator ?? '—'}</td>
                  <td style={td}>{fmtMW(r.capacity_mw)}</td>
                  <td style={td}>{fmtYear(r.commercial_operation_date)}</td>
                  <td style={{ ...td, color: expiring ? 'var(--color-amber)' : undefined, fontWeight: expiring ? 600 : undefined }}>
                    {fmtYear(r.license_expiration_date)}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: chip.bg, color: chip.color }}>
                      {r.status?.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td = { padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--color-border)' }

function Select({ label, value, onChange, options }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.85rem', fontFamily: 'var(--font-body)', background: '#fff' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
