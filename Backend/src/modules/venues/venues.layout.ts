/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { z } from 'zod'

// Shape of a layout file. The format is documented in layouts/README.md.

const key = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Keys must be UPPER_SNAKE_CASE')

const category = z.object({
  key,
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex code like #C9A227'),
})

const row = z.object({
  label: z.string().min(1),
  seats: z.number().int().positive(),
  category: key,
})

const section = z.object({
  key,
  label: z.string().min(1),
  rows: z.array(row).min(1),
})

const zone = z.object({
  key,
  label: z.string().min(1),
  category: key,
  capacity: z.number().int().positive(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().positive().max(100),
  height: z.number().positive().max(100),
})

const base = {
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacity: z.number().int().positive(),
  stage: z.object({ position: z.enum(['top', 'bottom', 'left', 'right']) }),
  categories: z.array(category).min(1),
}

// strictObject rejects unknown keys, so a SEATED file with "zones" (or the reverse) fails (rule 6)
export const layoutSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('SEATED'), sections: z.array(section).min(1) }),
  z.strictObject({ ...base, type: z.literal('STANDING'), zones: z.array(zone).min(1) }),
])

export type VenueLayout = z.infer<typeof layoutSchema>

export interface ExpandedSeat {
  section: string
  row: string
  number: number
  label: string // e.g. ORC-A-7
  categoryKey: string
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const v of values) {
    if (seen.has(v)) dupes.add(v)
    seen.add(v)
  }
  return [...dupes]
}

// Rules 2–5 from the README. Rule 1 (slug matches filename) needs the filename, so it lives in loadLayoutFile.
export function checkLayoutRules(layout: VenueLayout): string[] {
  const errors: string[] = []
  const declared = layout.categories.map((c) => c.key)

  for (const d of findDuplicates(declared)) errors.push(`Category "${d}" is declared twice`)

  const used: string[] = []
  let total = 0

  if (layout.type === 'SEATED') {
    for (const d of findDuplicates(layout.sections.map((s) => s.key))) {
      errors.push(`Section "${d}" is declared twice`)
    }
    for (const s of layout.sections) {
      for (const d of findDuplicates(s.rows.map((r) => r.label))) {
        errors.push(`Row "${d}" appears twice in section "${s.key}"`)
      }
      for (const r of s.rows) {
        used.push(r.category)
        total += r.seats
      }
    }
  } else {
    for (const d of findDuplicates(layout.zones.map((z) => z.key))) {
      errors.push(`Zone "${d}" is declared twice`)
    }
    for (const z of layout.zones) {
      used.push(z.category)
      total += z.capacity
    }
  }

  for (const u of new Set(used)) {
    if (!declared.includes(u)) errors.push(`Category "${u}" is used but not declared in "categories"`)
  }
  for (const d of declared) {
    if (!used.includes(d)) errors.push(`Category "${d}" is declared but never used`)
  }
  if (total !== layout.capacity) {
    errors.push(`Capacity is ${layout.capacity} but seats/zones add up to ${total}`)
  }

  return errors
}

export class LayoutError extends Error {
  constructor(public file: string, public problems: string[]) {
    super(`Invalid venue layout ${file}:\n  - ${problems.join('\n  - ')}`)
  }
}

export function loadLayoutFile(filePath: string): VenueLayout {
  const file = path.basename(filePath)

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    throw new LayoutError(file, [`Could not read JSON: ${(err as Error).message}`])
  }

  const parsed = layoutSchema.safeParse(raw)
  if (!parsed.success) {
    throw new LayoutError(
      file,
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    )
  }

  const problems = checkLayoutRules(parsed.data)
  if (parsed.data.slug !== path.basename(filePath, '.json')) {
    problems.unshift(`Slug "${parsed.data.slug}" does not match filename "${file}"`)
  }
  if (problems.length > 0) throw new LayoutError(file, problems)

  return parsed.data
}

export const LAYOUTS_DIR = path.join(__dirname, 'layouts')

export function loadAllLayouts(dir: string = LAYOUTS_DIR): VenueLayout[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => loadLayoutFile(path.join(dir, f)))
}

// Turns rows like { label: 'A', seats: 16 } into 16 individual seats. Used by the seeding script.
export function expandSeats(layout: VenueLayout): ExpandedSeat[] {
  if (layout.type !== 'SEATED') return []
  const seats: ExpandedSeat[] = []
  for (const s of layout.sections) {
    for (const r of s.rows) {
      for (let n = 1; n <= r.seats; n++) {
        seats.push({
          section: s.key,
          row: r.label,
          number: n,
          label: `${s.key}-${r.label}-${n}`,
          categoryKey: r.category,
        })
      }
    }
  }
  return seats
}
