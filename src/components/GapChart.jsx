import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

function toGW(mw) {
  return mw != null ? +(parseFloat(mw) / 1000).toFixed(2) : 0
}

function buildChartData(gapSeries) {
  if (!gapSeries.length) return []

  const base = toGW(gapSeries[0].net_capacity_mw) + toGW(gapSeries[0].retiring_mw)

  return gapSeries.map(row => {
    const net  = toGW(row.net_capacity_mw)
    const gap  = +(base - net).toFixed(2)
    return {
      year:      row.year,
      net_gw:    net,
      gap_gw:    gap,
      add_gw:    toGW(row.adding_mw),
      retire_gw: toGW(row.retiring_mw),
    }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ color: 'var(--color-operating)' }}>Net capacity: {d.net_gw?.toFixed(1)} GW</div>
      <div style={{ color: 'var(--color-amber)' }}>Gap from baseline: {d.gap_gw?.toFixed(1)} GW</div>
      {d.retire_gw > 0 && <div style={{ color: 'var(--color-shutdown)' }}>Retiring this year: {d.retire_gw.toFixed(1)} GW</div>}
      {d.add_gw > 0    && <div style={{ color: 'var(--color-pipeline)' }}>Adding this year: {d.add_gw.toFixed(1)} GW</div>}
    </div>
  )
}

export default function GapChart({ gapSeries, headlines }) {
  const data = buildChartData(gapSeries)
  if (!data.length) return null

  const retiring2035 = headlines?.retiring_by_2035_mw
    ? (parseFloat(headlines.retiring_by_2035_mw) / 1000).toFixed(1)
    : null

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
          />
          <YAxis
            tickFormatter={v => `${v} GW`}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* The gap — amber fill representing lost capacity */}
          <Area
            type="monotone"
            dataKey="gap_gw"
            stackId="1"
            fill="var(--color-amber)"
            fillOpacity={0.85}
            stroke="none"
            name="Capacity gap"
          />

          {/* Net remaining capacity — green */}
          <Area
            type="monotone"
            dataKey="net_gw"
            stackId="1"
            fill="var(--color-operating)"
            fillOpacity={0.8}
            stroke="var(--color-operating)"
            strokeWidth={2}
            name="Net capacity"
          />

          <ReferenceLine
            x={2035}
            stroke="var(--color-brand)"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{
              value: retiring2035 ? `← ${retiring2035} GW gap by 2035` : '2035',
              position: 'insideTopRight',
              fill: 'var(--color-amber)',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

    </div>
  )
}
