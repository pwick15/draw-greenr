import { multiPolyArea, ringPerimeter } from './geometry'
import type { AssetDef, GardenDoc, MaterialDef } from './types'

/**
 * A materials take-off: what is in the plan, how much of it, and how many
 * square metres of ground it sits on.
 *
 * This is the step Gardena leaves out. A plan is a picture until someone has
 * to price it, and everything needed to price it is already in the document —
 * counts, sizes, and the exact area of each material, which the partition
 * model makes honest because no surface is hidden underneath another.
 */

export interface ScheduleRow {
  assetId: string
  name: string
  category: string
  count: number
  /** Nominal size in metres, or null where instances differ. */
  width: number | null
  height: number | null
  /** Combined footprint of every instance, m². */
  area: number
  /** Combined long-axis length of every instance, m. */
  length: number
  /** Measured by the metre rather than counted — fences, walls, hedges. */
  linear: boolean
}

export interface ScheduleGroup {
  category: string
  rows: ScheduleRow[]
  count: number
}

export interface AreaRow {
  materialId: string
  name: string
  area: number
  /** Edge length of the material, m — what edging or kerbing is costed on. */
  perimeter: number
}

export interface Takeoff {
  planName: string
  groups: ScheduleGroup[]
  areas: AreaRow[]
  totals: {
    objects: number
    distinctAssets: number
    groundArea: number
    linearMetres: number
  }
}

/**
 * How much longer than it is wide before something counts as a run.
 *
 * Deriving this from the shape rather than a list of categories means a hedge
 * filed under shrubs, a stretched border and a fence are all measured the way
 * they are actually bought, and a custom asset gets the same treatment with no
 * extra configuration.
 */
const LINEAR_ASPECT = 3

const round2 = (n: number): number => Math.round(n * 100) / 100

export function buildTakeoff(
  doc: GardenDoc,
  assets: ReadonlyMap<string, AssetDef>,
  materials: ReadonlyMap<string, MaterialDef>,
): Takeoff {
  interface Accumulator {
    row: ScheduleRow
    widths: Set<number>
    heights: Set<number>
  }
  const byAsset = new Map<string, Accumulator>()

  for (const object of Object.values(doc.objects)) {
    if (object.hidden) continue
    const asset = assets.get(object.assetId)
    const long = Math.max(object.w, object.h)
    const short = Math.min(object.w, object.h)

    let entry = byAsset.get(object.assetId)
    if (!entry) {
      entry = {
        row: {
          assetId: object.assetId,
          // A deleted custom asset still leaves objects behind; name them by
          // id rather than dropping them from a count someone will price.
          name: asset?.name ?? object.assetId,
          category: asset?.category ?? 'other',
          count: 0,
          width: null,
          height: null,
          area: 0,
          length: 0,
          linear: false,
        },
        widths: new Set(),
        heights: new Set(),
      }
      byAsset.set(object.assetId, entry)
    }

    entry.row.count++
    entry.row.area += object.w * object.h
    entry.row.length += long
    entry.widths.add(round2(object.w))
    entry.heights.add(round2(object.h))
    // One stretched instance is enough to make the whole line a run: that is
    // how it will be bought.
    if (short > 0 && long / short >= LINEAR_ASPECT) entry.row.linear = true
  }

  const rows: ScheduleRow[] = []
  for (const { row, widths, heights } of byAsset.values()) {
    rows.push({
      ...row,
      width: widths.size === 1 ? [...widths][0] : null,
      height: heights.size === 1 ? [...heights][0] : null,
      area: round2(row.area),
      length: round2(row.length),
    })
  }

  const byCategory = new Map<string, ScheduleRow[]>()
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? []
    list.push(row)
    byCategory.set(row.category, list)
  }

  const groups: ScheduleGroup[] = [...byCategory.entries()]
    .map(([category, list]) => ({
      category,
      rows: list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      count: list.reduce((n, r) => n + r.count, 0),
    }))
    .sort((a, b) => a.category.localeCompare(b.category))

  const areas: AreaRow[] = doc.surfaces
    .filter((s) => !s.hidden)
    .map((surface) => {
      let perimeter = 0
      for (const poly of surface.geometry) for (const ring of poly) perimeter += ringPerimeter(ring)
      return {
        materialId: surface.materialId,
        name: materials.get(surface.materialId)?.name ?? surface.materialId,
        area: round2(multiPolyArea(surface.geometry)),
        perimeter: round2(perimeter),
      }
    })
    .filter((row) => row.area > 0)
    .sort((a, b) => b.area - a.area)

  return {
    planName: doc.name,
    groups,
    areas,
    totals: {
      objects: rows.reduce((n, r) => n + r.count, 0),
      distinctAssets: rows.length,
      groundArea: round2(areas.reduce((n, r) => n + r.area, 0)),
      linearMetres: round2(rows.filter((r) => r.linear).reduce((n, r) => n + r.length, 0)),
    },
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Quote a field only when it needs it, and double any quotes inside. */
function csvField(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const csvRow = (fields: (string | number)[]): string => fields.map(csvField).join(',')

/**
 * Flatten a take-off into a spreadsheet.
 *
 * Sections are stacked in one file rather than split across several, because
 * the thing anyone actually does with this is open it, add a price column and
 * total it — and that is easier in one sheet.
 */
export function takeoffToCsv(takeoff: Takeoff, generatedAt = new Date()): string {
  const lines: string[] = []

  lines.push(csvRow(['Draw Greenr take-off', takeoff.planName]))
  lines.push(csvRow(['Generated', generatedAt.toISOString().slice(0, 10)]))
  lines.push('')

  lines.push(csvRow(['SCHEDULE']))
  lines.push(
    csvRow(['Category', 'Item', 'Count', 'Width (m)', 'Height (m)', 'Area (m2)', 'Length (m)']),
  )
  for (const group of takeoff.groups) {
    for (const row of group.rows) {
      lines.push(
        csvRow([
          group.category,
          row.name,
          row.count,
          row.width ?? 'varies',
          row.height ?? 'varies',
          row.area,
          row.linear ? row.length : '',
        ]),
      )
    }
  }
  lines.push('')

  lines.push(csvRow(['GROUND MATERIALS']))
  lines.push(csvRow(['Material', 'Area (m2)', 'Edge length (m)']))
  for (const row of takeoff.areas) lines.push(csvRow([row.name, row.area, row.perimeter]))
  lines.push('')

  lines.push(csvRow(['TOTALS']))
  lines.push(csvRow(['Objects', takeoff.totals.objects]))
  lines.push(csvRow(['Distinct items', takeoff.totals.distinctAssets]))
  lines.push(csvRow(['Ground area (m2)', takeoff.totals.groundArea]))
  lines.push(csvRow(['Runs — fences, walls, hedges (m)', takeoff.totals.linearMetres]))

  return lines.join('\n')
}
