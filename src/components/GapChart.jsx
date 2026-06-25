import {
  ComposedChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

function toGW(mw) {
  return mw != null ? +(parseFloat(mw) / 1000).toFixed(2) : 0
}

function buildChartData(gapSeries, demandSeries = []) {
  if (!gapSeries.length) return []

  const base = toGW(gapSeries[0].net_capacity_mw) + toGW(gapSeries[0].retiring_mw)
  const demandByYear = new Map(demandSeries.map(d => [d.year, d]))

  return gapSeries.map(row => {
    const net  = toGW(row.net_capacity_mw)
    const gap  = Math.max(0, +(base - net).toFixed(2))
    const d = demandByYear.get(row.year)
    // Stacked Area series need numeric values across the whole domain — null
    // here (no demand row yet, e.g. before the migration lands) breaks Recharts'
    // stack offset calculation for the *entire* chart silently. 0 = an
    // invisible zero-height band, which is also the right look for "no data yet".
    const demandLow  = d ? toGW(d.demand_mw_low)  : 0
    const demandHigh = d ? toGW(d.demand_mw_high) : 0
    return {
      year:      row.year,
      base_gw:   base,
      net_gw:    net,
      gap_gw:    gap,
      add_gw:    toGW(row.adding_mw),
      retire_gw: toGW(row.retiring_mw),
      demand_low_gw:  demandLow,
      demand_band_gw: +Math.max(0, demandHigh - demandLow).toFixed(2),
      demand_high_gw: d ? demandHigh : null,
    }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-text)' }}>{label}</div>
      <div style={{ color: 'var(--color-operating)' }}>Net capacity: {d.net_gw?.toFixed(1)} GW</div>
      <div style={{ color: 'var(--color-decommissioning)' }}>Gap from baseline: {d.gap_gw?.toFixed(1)} GW</div>
      {d.retire_gw > 0 && <div style={{ color: 'var(--color-text-muted)' }}>Retiring this year: {d.retire_gw.toFixed(1)} GW</div>}
      {d.add_gw > 0    && <div style={{ color: 'var(--color-pipeline)' }}>Adding this year: {d.add_gw.toFixed(1)} GW</div>}
      {d.demand_high_gw != null && (
        <div style={{ color: 'var(--color-demand)' }}>
          Demand growth implies +{d.demand_low_gw.toFixed(1)}–{d.demand_high_gw.toFixed(1)} GW new firm capacity
        </div>
      )}
    </div>
  )
}

export default function GapChart({ gapSeries, headlines, demandSeries = [] }) {
  const data = buildChartData(gapSeries, demandSeries)
  if (!data.length) return null

  const retiring2035 = headlines?.retiring_by_2035_mw
    ? (parseFloat(headlines.retiring_by_2035_mw) / 1000).toFixed(1)
    : null

  return (
    <div style={{ position: 'relative', width: '100%', height: 240, background: 'var(--color-operating)' }}>
      {/* Title + subtitle overlaid inside the green canvas */}
      <div style={{ position: 'absolute', top: '1.1rem', left: '2.5rem', zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
          The Gap
        </div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.35rem', maxWidth: '21rem' }}>
          US nuclear capacity 2025–2045 — the amber is what we lose faster than we replace. The dashed band is
          how much new firm capacity nationwide demand growth implies, for scale, not a claim nuclear alone covers it.{' '}
          <a href="/sources"
             target="_blank" rel="noreferrer"
             style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', pointerEvents: 'auto' }}>
            How we calculated this →
          </a>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: 'rgba(255,255,255,0.85)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
            height={26}
          />
          <YAxis
            mirror
            tickFormatter={v => `${v} GW`}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={1}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.4)' }} />

          {/* The gap — amber wedge cutting in from the bottom */}
          <Area
            type="monotone"
            dataKey="gap_gw"
            stackId="1"
            fill="var(--color-amber)"
            fillOpacity={1}
            stroke="#fff"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            name="Capacity gap"
          />

          {/* Net remaining capacity — fills the rest of the green canvas */}
          <Area
            type="monotone"
            dataKey="net_gw"
            stackId="1"
            fill="var(--color-operating)"
            fillOpacity={1}
            stroke="none"
            name="Net capacity"
          />

          {/* Demand-growth band — independent stack, translucent overlay, the EIA
              AEO2026 reference-case low/high range converted to implied new firm
              capacity (see ADR-0014). Not part of the nuclear capacity stack above. */}
          <Area type="monotone" dataKey="demand_low_gw" stackId="2" fill="transparent" stroke="none" />
          <Area
            type="monotone"
            dataKey="demand_band_gw"
            stackId="2"
            fill="var(--color-demand)"
            fillOpacity={0.32}
            stroke="var(--color-demand)"
            strokeWidth={1.5}
            strokeOpacity={0.85}
            strokeDasharray="4 3"
            name="Demand growth (implied new firm capacity)"
          />

          <ReferenceLine
            x={2035}
            stroke="rgba(255,255,255,0.5)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: retiring2035 ? `${retiring2035} GW gap by 2035` : '2035',
              position: 'insideTopRight',
              fill: '#fff',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
