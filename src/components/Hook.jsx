import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import isoRegions from '../data/iso-regions.json'


const STATUS_COLORS = {
  operating:      '#2d6a4f',
  license_renewed:'#52b788',
  decommissioning:'#e76f51',
  shutdown:       '#6c757d',
}

// One label point per ISO region — placed on the region's largest polygon part
// so a MultiPolygon doesn't get labelled once per disjoint piece.
function isoLabelPoints(fc) {
  const features = fc.features.map(f => {
    const parts = f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates
      : [f.geometry.coordinates]
    let best = null, bestSpan = -1
    for (const poly of parts) {
      const ring = poly[0]
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
      const span = (maxX - minX) * (maxY - minY)
      if (span > bestSpan) { bestSpan = span; best = [(minX + maxX) / 2, (minY + maxY) / 2] }
    }
    return { type: 'Feature', geometry: { type: 'Point', coordinates: best }, properties: f.properties }
  })
  return { type: 'FeatureCollection', features }
}

function reactorsToGeoJSON(reactors) {
  return {
    type: 'FeatureCollection',
    features: reactors
      .filter(r => r.latitude != null && r.longitude != null)
      .map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)] },
        properties: { ...r },
      })),
  }
}

export default function Hook({ reactors, setSelectedISO, licenseActionsByReactor = {} }) {
  const mapContainer  = useRef(null)
  const map           = useRef(null)
  const reactorsRef   = useRef(reactors)
  const [panel, setPanel] = useState(null)

  reactorsRef.current = reactors

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      bounds: [[-125, 24], [-66.5, 49.5]],
      fitBoundsOptions: { padding: 20 },
      minZoom: 2.5,
      maxZoom: 10,
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      // ISO/RTO region context layer (beneath the reactor pins)
      map.current.addSource('iso-regions', { type: 'geojson', data: isoRegions })
      map.current.addLayer({
        id: 'iso-fill',
        type: 'fill',
        source: 'iso-regions',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 },
      })
      map.current.addLayer({
        id: 'iso-line',
        type: 'line',
        source: 'iso-regions',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-opacity': 0.55 },
      })
      map.current.addSource('iso-region-labels', { type: 'geojson', data: isoLabelPoints(isoRegions) })
      map.current.addLayer({
        id: 'iso-label',
        type: 'symbol',
        source: 'iso-region-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 1.5,
        },
      })

      map.current.addSource('reactors', {
        type: 'geojson',
        data: reactorsToGeoJSON(reactorsRef.current),
      })

      map.current.addLayer({
        id: 'reactor-circles',
        type: 'circle',
        source: 'reactors',
        paint: {
          'circle-color': [
            'match', ['get', 'status'],
            'operating',       STATUS_COLORS.operating,
            'license_renewed', STATUS_COLORS.license_renewed,
            'decommissioning', STATUS_COLORS.decommissioning,
            'shutdown',        STATUS_COLORS.shutdown,
            '#6c757d',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['to-number', ['get', 'capacity_mw'], 800],
            500, 6, 1300, 14,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.88,
        },
      })

      map.current.on('click', 'reactor-circles', e => {
        setPanel(e.features[0].properties)
      })

      map.current.on('mouseenter', 'reactor-circles', () => {
        map.current.getCanvas().style.cursor = 'pointer'
      })
      map.current.on('mouseleave', 'reactor-circles', () => {
        map.current.getCanvas().style.cursor = ''
      })

      map.current.on('click', e => {
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['reactor-circles'] })
        if (!features.length) setPanel(null)
      })
    })

    return () => {
      if (map.current) { map.current.remove(); map.current = null }
    }
  }, [])

  useEffect(() => {
    if (!map.current) return
    setPanel(null)
    const src = map.current.getSource('reactors')
    if (src) src.setData(reactorsToGeoJSON(reactors))
  }, [reactors])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapContainer} style={{ height: '600px', width: '100%', borderRadius: '4px', overflow: 'hidden' }} />
      <Legend />
      {panel && <DetailPanel reactor={panel} actions={licenseActionsByReactor[panel.id] ?? []} onClose={() => setPanel(null)} />}
    </div>
  )
}

function Legend() {
  const items = [
    { label: 'Operating',       color: STATUS_COLORS.operating },
    { label: 'License renewed', color: STATUS_COLORS.license_renewed },
    { label: 'Decommissioning', color: STATUS_COLORS.decommissioning },
    { label: 'Shutdown',        color: STATUS_COLORS.shutdown },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: '2rem', left: '1rem',
      background: 'rgba(255,255,255,0.92)', padding: '0.6rem 0.9rem',
      borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      fontSize: '0.75rem', fontFamily: 'var(--font-body)',
    }}>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', border: '1.5px solid #fff', boxShadow: '0 0 0 1px #ccc' }} />
          {label}
        </div>
      ))}
    </div>
  )
}

const ACTION_LABELS = {
  license_renewal:            'License renewal',
  subsequent_license_renewal: 'License extension (80 yr)',
  restart_authorization:      'Restart authorization',
}

function LicenseActionLine({ action }) {
  const pending = action.status === 'under_review'
  const label = ACTION_LABELS[action.action_type] ?? action.action_type?.replace(/_/g, ' ')
  const year = d => d ? new Date(d).getFullYear() : null
  return (
    <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: pending ? 'var(--color-amber)' : 'var(--color-text-muted)' }}>
      {pending ? '⏳' : '✓'} {label}{' '}
      {pending
        ? `under NRC review${year(action.action_date) ? ` (filed ${year(action.action_date)})` : ''}`
        : `${year(action.action_date) ?? ''}${year(action.new_expiration_date) ? ` → licensed to ${year(action.new_expiration_date)}` : ''}`}
    </div>
  )
}

function DetailPanel({ reactor, actions, onClose }) {
  const statusColor = STATUS_COLORS[reactor.status] ?? '#6c757d'
  // newest first; the panel shows at most the two most recent actions
  const shown = [...actions]
    .sort((a, b) => (b.action_date ?? '').localeCompare(a.action_date ?? ''))
    .slice(0, 2)

  function fmt(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).getFullYear()
  }

  return (
    <div style={{
      position: 'absolute', top: '1rem', right: '1rem',
      width: '260px', background: '#fff',
      borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      padding: '1.1rem 1.25rem', fontFamily: 'var(--font-body)',
      zIndex: 10,
    }}>
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '0.6rem', right: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#999' }}
      >×</button>

      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.1rem', paddingRight: '1rem' }}>
        {reactor.plant_name}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        Unit {reactor.unit_number}
      </div>

      <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '12px', background: statusColor, color: '#fff', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>
        {reactor.status?.replace('_', ' ')}
      </div>

      <Row label="Operator"   value={reactor.operator} />
      <Row label="State"      value={reactor.state} />
      <Row label="Capacity"   value={reactor.capacity_mw ? `${parseFloat(reactor.capacity_mw).toLocaleString()} MW` : '—'} />
      <Row label="Commercial" value={fmt(reactor.commercial_operation_date)} />
      <Row label="License exp" value={fmt(reactor.license_expiration_date)} highlight={isExpiringSoon(reactor.license_expiration_date)} />
      <Row label="ISO/RTO"    value={reactor.iso_rto ?? '—'} />

      {shown.length > 0 && (
        <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
          {shown.map(a => <LicenseActionLine key={a.id} action={a} />)}
        </div>
      )}

      {reactor.daily_status && (() => {
        const pct = parseInt(reactor.daily_status, 10)
        const offline = pct === 0
        const cap = parseFloat(reactor.capacity_mw)
        const outputMW = !isNaN(pct) && !isNaN(cap) ? Math.round((pct / 100) * cap) : null
        return (
          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: offline ? 'var(--color-decommissioning)' : 'var(--color-operating)', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
            ● {offline
                ? 'Offline — 0% power'
                : <>{reactor.daily_status}{outputMW != null && <span style={{ color: 'var(--color-text-muted)' }}> · ~{outputMW.toLocaleString()} MW now</span>}</>}
            {reactor.daily_status_updated_at && (
              <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
                ({new Date(reactor.daily_status_updated_at).toLocaleDateString()})
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false
  const exp = new Date(dateStr).getFullYear()
  return exp <= new Date().getFullYear() + 10
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem', color: highlight ? 'var(--color-amber)' : undefined }}>
      <span style={{ color: highlight ? 'var(--color-amber)' : 'var(--color-text-muted)', flexShrink: 0, marginRight: '0.5rem' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  )
}
