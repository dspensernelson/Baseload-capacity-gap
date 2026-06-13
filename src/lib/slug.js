// Stable, pretty slugs for reactor permalinks — e.g. "Browns Ferry" unit 1 → "browns-ferry-1".
// Computed from plant_name + unit_number (which are unique together), so no schema change needed.
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function reactorSlug(r) {
  return slugify(`${r.plant_name} ${r.unit_number ?? ''}`)
}
