import { useState, useMemo } from 'react'

// U.S. average capacity factors (EIA). Nuclear runs near-constantly; wind and
// solar deliver a fraction of their nameplate over a year, so matching a
// reactor's ANNUAL ENERGY takes far more nameplate — before you even add the
// storage needed to cover nights and calm spells.
const NUCLEAR_CF = 0.93
const WIND_CF = 0.35
const SOLAR_CF = 0.24
const MW_PER_TURBINE = 3.2     // modern onshore turbine
const ACRES_PER_MW_SOLAR = 6   // utility-scale solar, rough

function Bar({ label, mw, max, color, sub }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{Math.round(mw).toLocaleString()} MW{sub ? ` · ${sub}` : ''}</span>
      </div>
      <div style={{ height: 18, background: 'var(--color-surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, (mw / max) * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

export default function ReplacementMath({ reactors = [] }) {
  const operating = useMemo(
    () => reactors
      .filter(r => (r.status === 'operating' || r.status === 'license_renewed') && parseFloat(r.capacity_mw) > 0)
      .sort((a, b) => `${a.plant_name} ${a.unit_number}`.localeCompare(`${b.plant_name} ${b.unit_number}`)),
    [reactors]
  )

  const biggest = useMemo(
    () => operating.reduce((m, r) => (parseFloat(r.capacity_mw) > parseFloat(m?.capacity_mw ?? 0) ? r : m), null),
    [operating]
  )
  const [id, setId] = useState(null)
  const selected = operating.find(r => r.id === id) ?? biggest
  if (!selected) return null

  const cap = parseFloat(selected.capacity_mw)
  const twh = (cap * 8760 * NUCLEAR_CF) / 1e6
  const windMW = cap * (NUCLEAR_CF / WIND_CF)
  const solarMW = cap * (NUCLEAR_CF / SOLAR_CF)
  const turbines = Math.round(windMW / MW_PER_TURBINE)
  const solarSqMi = (solarMW * ACRES_PER_MW_SOLAR) / 640
  const max = solarMW

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Replace</span>
        <select
          value={selected.id}
          onChange={e => setId(e.target.value)}
          style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'var(--font-body)', background: '#fff', maxWidth: '320px' }}
        >
          {operating.map(r => (
            <option key={r.id} value={r.id}>{r.plant_name} {r.unit_number} — {Math.round(parseFloat(r.capacity_mw)).toLocaleString()} MW</option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        At a <strong>{Math.round(NUCLEAR_CF * 100)}%</strong> capacity factor, this <strong>{Math.round(cap).toLocaleString()} MW</strong> reactor
        generates about <strong>{twh.toFixed(1)} TWh</strong> a year. To match that much <em>energy</em> you'd need roughly{' '}
        <strong style={{ color: '#2c5d8a' }}>{(windMW / 1000).toFixed(1)} GW of wind</strong> or{' '}
        <strong style={{ color: '#b8860b' }}>{(solarMW / 1000).toFixed(1)} GW of solar</strong> — two to four times the nameplate, on new land.
      </p>

      <Bar label="This reactor" mw={cap} max={max} color="#2d6a4f" />
      <Bar label="Wind to match its energy" mw={windMW} max={max} color="#457b9d" sub={`~${turbines.toLocaleString()} turbines`} />
      <Bar label="Solar to match its energy" mw={solarMW} max={max} color="#f6c453" sub={`~${solarSqMi.toFixed(0)} sq mi`} />

      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '1.25rem', lineHeight: 1.55 }}>
        This is an <strong>energy-only</strong> match — and the easy part. It doesn't include the storage to cover nights and
        calm spells, the transmission, or the land. The honest point isn't that wind and solar are bad; it's that the
        exchange rate is real, and firm clean power is hard to replace one-for-one. Capacity factors: U.S. averages (EIA) —
        nuclear {Math.round(NUCLEAR_CF * 100)}%, wind {Math.round(WIND_CF * 100)}%, solar {Math.round(SOLAR_CF * 100)}%.
      </p>
    </div>
  )
}
