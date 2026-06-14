import { useState } from 'react'
import supabase from '../supabase'

const DATASETS = [
  { table: 'reactors',            label: 'Reactor inventory',   desc: 'Every U.S. power reactor — location, capacity, license dates, status, latest power %.' },
  { table: 'gap_series',          label: 'Gap projection',      desc: 'Year-by-year retiring vs. added capacity through 2045.' },
  { table: 'headline_numbers',    label: 'Headline numbers',    desc: 'Operating today, retiring by 2035, confirmed pipeline.' },
  { table: 'license_actions',     label: 'License actions',     desc: 'NRC renewals and 80-year extensions — approved and under review.' },
  { table: 'fleet_output_series', label: 'Daily fleet output',  desc: 'Daily summed U.S. nuclear generation, trailing ~year.' },
  { table: 'new_reactor_projects', label: 'New-build pipeline', desc: 'Restarts and SMR / new-build projects.' },
  { table: 'generation_hourly',   label: 'Hourly grid mix',     desc: 'EIA-930 U.S. generation by fuel type, recent hours.' },
]

function toCSV(rows) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = v => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')
}

function download(name, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

export default function DataExport() {
  const [busy, setBusy] = useState(null)
  const base = import.meta.env.VITE_SUPABASE_URL

  async function grab(table, fmt) {
    setBusy(`${table}-${fmt}`)
    try {
      const { data } = await supabase.from(table).select('*')
      const rows = data ?? []
      if (fmt === 'csv') download(`${table}.csv`, toCSV(rows), 'text/csv;charset=utf-8')
      else download(`${table}.json`, JSON.stringify(rows, null, 2), 'application/json')
    } finally {
      setBusy(null)
    }
  }

  const btn = {
    padding: '0.3rem 0.7rem', borderRadius: '6px', border: '1px solid var(--color-border)',
    background: '#fff', fontSize: '0.78rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: 500,
  }

  return (
    <section style={{ maxWidth: '820px', marginTop: '3rem', paddingBottom: '4rem' }} className="centered">
      <h2 className="section-title">Open data</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '46rem', marginBottom: '2rem' }}>
        It's all public records, re-plumbed — and it's yours. Download any dataset as CSV or JSON. Free to use,
        attribution appreciated. Sources: U.S. NRC and U.S. EIA.
      </p>

      {DATASETS.map(d => (
        <div key={d.table} style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{d.label}{' '}
              <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>{d.table}</code>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{d.desc}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button style={btn} disabled={busy === `${d.table}-csv`} onClick={() => grab(d.table, 'csv')}>{busy === `${d.table}-csv` ? '…' : 'CSV'}</button>
            <button style={btn} disabled={busy === `${d.table}-json`} onClick={() => grab(d.table, 'json')}>{busy === `${d.table}-json` ? '…' : 'JSON'}</button>
          </div>
        </div>
      ))}

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1.75rem', lineHeight: 1.6 }}>
        <strong>Raw API:</strong> every table is also queryable read-only via the Supabase REST API at{' '}
        <code style={{ wordBreak: 'break-all' }}>{base}/rest/v1/&lt;table&gt;?select=*</code> (the browser anon key is
        embedded in this app). All editorial math lives in the views above, so the numbers you see are the numbers you get.
      </p>
    </section>
  )
}
