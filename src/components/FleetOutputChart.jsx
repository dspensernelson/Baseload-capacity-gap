import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

function fmtMonth(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })
}
function fmtFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.85rem', fontSize: '0.8rem', fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{fmtFull(d.date)}</div>
      <div style={{ color: 'var(--color-operating)' }}>{d.gw.toFixed(1)} GW generating</div>
      {d.cf != null && <div style={{ color: 'var(--color-text-muted)' }}>{d.cf}% of fleet capacity</div>}
      {d.offline > 0 && <div style={{ color: 'var(--color-text-muted)' }}>{d.offline} unit{d.offline !== 1 ? 's' : ''} offline</div>}
    </div>
  )
}

export default function FleetOutputChart({ series }) {
  if (!series?.length) return null

  const data = series.map(r => {
    const out = parseFloat(r.output_mw) / 1000
    const cap = parseFloat(r.capacity_mw) / 1000
    return {
      date: r.report_date,
      gw: out,
      cf: cap ? Math.round((out / cap) * 100) : null,
      offline: parseInt(r.units_offline, 10) || 0,
    }
  })

  const capacity = Math.max(...data.map(d => parseFloat(d.gw)))
  const fleetCap = Math.max(...series.map(r => parseFloat(r.capacity_mw) / 1000))
  const yMax = Math.ceil((fleetCap + 5) / 5) * 5
  const avg = (data.reduce((a, b) => a + b.gw, 0) / data.length).toFixed(1)

  // one tick per month
  const ticks = []
  let lastMonth = null
  data.forEach(d => {
    const m = d.date.slice(0, 7)
    if (m !== lastMonth) { ticks.push(d.date); lastMonth = m }
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="fleetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--color-operating)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--color-operating)" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={fmtMonth}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={v => `${v}`}
            tick={{ fontFamily: 'var(--font-body)', fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={32}
            label={{ value: 'GW', position: 'insideTopLeft', offset: -2, fontSize: 11, fill: 'var(--color-text-muted)' }}
          />
          <Tooltip content={<Tip />} />
          <Area
            type="monotone"
            dataKey="gw"
            stroke="var(--color-operating)"
            strokeWidth={1.5}
            fill="url(#fleetFill)"
            isAnimationActive={false}
          />
          <ReferenceLine
            y={fleetCap}
            stroke="var(--color-text-muted)"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: `fleet capacity ~${fleetCap.toFixed(0)} GW`, position: 'insideTopRight', fontSize: 11, fill: 'var(--color-text-muted)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Averaged {avg} GW over the year — steady near capacity, with dips for scheduled refueling outages.
        Summed daily from NRC power-status reports.
      </p>
    </div>
  )
}
