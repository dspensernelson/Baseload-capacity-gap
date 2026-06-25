// Dynamic OG/Twitter share card. Edge function so every shared link always carries
// the live headline numbers — no rebuild or deploy hook needed to stay current.
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const toGW = mw => (mw == null ? '—' : (Number(mw) / 1000).toFixed(1) + ' GW')

async function fetchHeadlines() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/headline_numbers?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

function col(value, label, color) {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column' },
      children: [
        { type: 'div', props: { style: { fontSize: 64, fontWeight: 900, color }, children: value } },
        { type: 'div', props: { style: { fontSize: 18, color: '#666666', letterSpacing: 2, marginTop: 6 }, children: label } },
      ],
    },
  }
}

export default async function handler() {
  const headlines = await fetchHeadlines()

  const stats = [
    col(toGW(headlines?.operating_mw), 'OPERATING TODAY', '#1d3557'),
    col(toGW(headlines?.retiring_by_2035_mw), 'RETIRING BY 2035', '#f4a261'),
    col(toGW(headlines?.confirmed_pipeline_mw), 'IN THE PIPELINE', '#1d3557'),
  ]

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        backgroundColor: '#ffffff', padding: '64px 72px', fontFamily: 'sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 22, letterSpacing: 4, color: '#666666', textTransform: 'uppercase', fontWeight: 600 },
            children: 'NUCLEAR PIPELINE TRACKER',
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 46, color: '#1d3557', fontWeight: 900, marginTop: 18, lineHeight: 1.15, maxWidth: 1000 },
            children: "The gap between what's retiring and what's replacing it",
          },
        },
        {
          type: 'div',
          props: { style: { display: 'flex', marginTop: 'auto', gap: 56 }, children: stats },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 16, color: '#666666', marginTop: 28 },
            children: 'Every reactor, every megawatt - updated daily from NRC and EIA records',
          },
        },
      ],
    },
  }

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}
