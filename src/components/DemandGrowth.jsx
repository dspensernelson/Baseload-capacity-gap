import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function toGW(mw) {
  return mw != null ? +(parseFloat(mw) / 1000).toFixed(1) : null
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.78rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ color: 'var(--color-demand)' }}>+{d.low?.toFixed(0)}–{d.high?.toFixed(0)} GW implied</div>
    </div>
  )
}

// Whole-grid demand growth, shown as its own module — not overlaid on the
// nuclear-specific gap chart, which made the front page read as if nuclear
// alone had to cover total grid growth. Context, not combat (see ADR-0014).
export default function DemandGrowth({ demandSeries = [] }) {
  const data = demandSeries
    .map(d => {
      const low = toGW(d.demand_mw_low)
      const high = toGW(d.demand_mw_high)
      if (low == null || high == null) return null
      return { year: d.year, low, high, band: +(high - low).toFixed(1) }
    })
    .filter(Boolean)

  if (!data.length) return null
  const last = data[data.length - 1]

  return (
    <div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.1rem 1.35rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        <div style={{ fontSize: '0.95rem' }}>
          By <strong>{last.year}</strong>, EIA's reference case implies{' '}
          <strong style={{ color: 'var(--color-demand)' }}>+{last.low.toFixed(0)}–{last.high.toFixed(0)} GW</strong> of new
          firm capacity nationwide demand growth requires — roughly {(last.high / 102).toFixed(1)}× today's entire
          nuclear fleet.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Not a claim nuclear alone has to cover that — the same firm-capacity yardstick as Replacement Math, shown for scale.
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="year" tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} minTickGap={40} />
          <YAxis tickFormatter={v => `${v} GW`} tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<Tip />} />
          <Area type="monotone" dataKey="low" stackId="1" fill="transparent" stroke="none" />
          <Area type="monotone" dataKey="band" stackId="1" fill="var(--color-demand)" fillOpacity={0.4} stroke="var(--color-demand)" strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>
        EIA AEO2026 reference case (0.9–1.6%/yr through 2050), baselined to 4,430 TWh actual 2024 US electricity sales,
        converted to GW at a 90% capacity factor (firm generation) — see <a href="/sources" style={{ color: 'var(--color-brand)' }}>how we calculated this</a>.
      </p>
    </div>
  )
}
