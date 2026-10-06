/// <reference types="node" />
// Validates every venue layout file. Run with: npm run layouts:check
import { LayoutError, LAYOUTS_DIR, expandSeats, loadAllLayouts } from '../modules/venues/venues.layout'

try {
  const layouts = loadAllLayouts(LAYOUTS_DIR)
  for (const layout of layouts) {
    if (layout.type === 'SEATED') {
      const seats = expandSeats(layout)
      const perCategory = new Map<string, number>()
      for (const s of seats) perCategory.set(s.categoryKey, (perCategory.get(s.categoryKey) ?? 0) + 1)
      const breakdown = [...perCategory].map(([k, n]) => `${k} ${n}`).join(', ')
      console.log(`OK  ${layout.slug} (SEATED): ${seats.length} seats — ${breakdown}`)
    } else {
      const breakdown = layout.zones.map((z) => `${z.category} ${z.capacity}`).join(', ')
      console.log(`OK  ${layout.slug} (STANDING): ${layout.capacity} places — ${breakdown}`)
    }
  }
  console.log(`\nAll ${layouts.length} layouts valid.`)
} catch (err) {
  if (err instanceof LayoutError) {
    console.error(`FAIL ${err.message}`)
    process.exit(1)
  }
  throw err
}
