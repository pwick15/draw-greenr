import { describe, expect, it } from 'vitest'

import { buildTakeoff, takeoffToCsv } from './schedule'
import { pointsToRing } from './surfaces'
import type { AssetDef, GardenDoc, GardenObject, MaterialDef, Surface } from './types'
import { Band, DEFAULT_SETTINGS } from './types'

const asset = (id: string, name: string, category: string): AssetDef => ({
  id,
  name,
  category,
  band: Band.Planting,
  source: 'builtin',
  src: `/assets/${id}.svg`,
  defaultSize: { w: 1, h: 1 },
  aspectLocked: true,
  tags: [],
})

const ASSETS = new Map<string, AssetDef>([
  ['oak', asset('oak', 'Oak', 'trees')],
  ['boxwood-ball', asset('boxwood-ball', 'Boxwood ball', 'shrubs')],
  ['fence-4m', asset('fence-4m', 'Fence, 4 m', 'boundaries')],
  ['comma, name', asset('comma, name', 'Bench "Deluxe", oak', 'furniture')],
])

const MATERIALS = new Map<string, MaterialDef>([
  ['lawn', { id: 'lawn', name: 'Lawn', fill: '#7cb', textureScale: 2, occludes: true, source: 'builtin' }],
  [
    'paving',
    { id: 'paving', name: 'Paving', fill: '#ccc', textureScale: 1, occludes: true, source: 'builtin' },
  ],
])

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: `o${Math.random()}`,
  assetId: 'oak',
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Canopy,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

/** A 10x10 square of the given material. */
const surface = (materialId: string, size = 10): Surface => ({
  id: `s-${materialId}`,
  materialId,
  geometry: [
    [
      pointsToRing([
        { x: 0, y: 0 },
        { x: size, y: 0 },
        { x: size, y: size },
        { x: 0, y: size },
      ]),
    ],
  ],
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
})

const doc = (objects: GardenObject[] = [], surfaces: Surface[] = []): GardenDoc => ({
  id: 'd',
  name: 'Back garden',
  createdAt: 0,
  updatedAt: 0,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  surfaces,
  settings: { ...DEFAULT_SETTINGS },
})

describe('buildTakeoff counts', () => {
  it('counts repeats of the same asset on one line', () => {
    const plan = doc([object({ id: 'a' }), object({ id: 'b' }), object({ id: 'c' })])
    const { groups } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(groups).toHaveLength(1)
    expect(groups[0].rows[0].count).toBe(3)
  })

  it('separates different assets', () => {
    const plan = doc([object({ id: 'a' }), object({ id: 'b', assetId: 'boxwood-ball' })])
    const { groups, totals } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(groups.map((g) => g.category).sort()).toEqual(['shrubs', 'trees'])
    expect(totals.distinctAssets).toBe(2)
    expect(totals.objects).toBe(2)
  })

  it('leaves hidden objects out — they are not being planted', () => {
    const plan = doc([object({ id: 'a' }), object({ id: 'b', hidden: true })])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).totals.objects).toBe(1)
  })

  it('sums footprint area across instances', () => {
    const plan = doc([object({ id: 'a', w: 2, h: 3 }), object({ id: 'b', w: 2, h: 3 })])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0].area).toBe(12)
  })

  it('reports a single size when every instance matches', () => {
    const plan = doc([object({ id: 'a', w: 4, h: 4 }), object({ id: 'b', w: 4, h: 4 })])
    const row = buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0]
    expect(row.width).toBe(4)
    expect(row.height).toBe(4)
  })

  it('reports no single size once instances have been resized apart', () => {
    const plan = doc([object({ id: 'a', w: 4, h: 4 }), object({ id: 'b', w: 6, h: 4 })])
    const row = buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0]
    expect(row.width).toBeNull()
    // The axis that did not change still reports a size.
    expect(row.height).toBe(4)
  })

  it('names an object whose asset has been deleted rather than dropping it', () => {
    const plan = doc([object({ id: 'a', assetId: 'gone' })])
    const { groups, totals } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(totals.objects).toBe(1)
    expect(groups[0].rows[0].name).toBe('gone')
  })

  it('orders rows within a category by how many there are', () => {
    const plan = doc([
      object({ id: 'a', assetId: 'oak' }),
      object({ id: 'b', assetId: 'oak' }),
      object({ id: 'c', assetId: 'oak' }),
    ])
    const rows = buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows
    expect(rows[0].count).toBe(3)
  })
})

describe('linear runs', () => {
  it('measures a long thin object by the metre', () => {
    const plan = doc([object({ id: 'a', assetId: 'fence-4m', w: 4, h: 0.2 })])
    const row = buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0]
    expect(row.linear).toBe(true)
    expect(row.length).toBe(4)
  })

  it('does not treat a roughly square object as a run', () => {
    const plan = doc([object({ id: 'a', w: 4, h: 4 })])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0].linear).toBe(false)
  })

  it('measures along the long axis whichever way round it is', () => {
    const plan = doc([object({ id: 'a', assetId: 'fence-4m', w: 0.2, h: 6 })])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).groups[0].rows[0].length).toBe(6)
  })

  it('totals only the runs, not everything', () => {
    const plan = doc([
      object({ id: 'a', assetId: 'fence-4m', w: 4, h: 0.2 }),
      object({ id: 'b', assetId: 'fence-4m', w: 6, h: 0.2 }),
      object({ id: 'c', assetId: 'oak', w: 4, h: 4 }),
    ])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).totals.linearMetres).toBe(10)
  })

  it('survives a zero-width object without dividing by zero', () => {
    const plan = doc([object({ id: 'a', w: 0, h: 4 })])
    const { totals } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(Number.isFinite(totals.linearMetres)).toBe(true)
  })
})

describe('ground materials', () => {
  it('reports the area of each material', () => {
    const plan = doc([], [surface('lawn', 10)])
    const { areas } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(areas).toHaveLength(1)
    expect(areas[0].name).toBe('Lawn')
    expect(areas[0].area).toBe(100)
  })

  it('reports edge length, which is what edging is costed on', () => {
    const plan = doc([], [surface('lawn', 10)])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).areas[0].perimeter).toBe(40)
  })

  it('lists the largest material first', () => {
    const plan = doc([], [surface('lawn', 10), surface('paving', 4)])
    const { areas } = buildTakeoff(plan, ASSETS, MATERIALS)
    expect(areas.map((a) => a.name)).toEqual(['Lawn', 'Paving'])
  })

  it('leaves hidden surfaces out', () => {
    const plan = doc([], [{ ...surface('lawn', 10), hidden: true }])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).areas).toEqual([])
  })

  it('totals ground area across materials', () => {
    const plan = doc([], [surface('lawn', 10), surface('paving', 4)])
    expect(buildTakeoff(plan, ASSETS, MATERIALS).totals.groundArea).toBe(116)
  })
})

describe('takeoffToCsv', () => {
  const plan = doc(
    [object({ id: 'a' }), object({ id: 'b', assetId: 'fence-4m', w: 4, h: 0.2 })],
    [surface('lawn', 10)],
  )
  const csv = () => takeoffToCsv(buildTakeoff(plan, ASSETS, MATERIALS), new Date('2026-09-29'))

  it('carries the plan name and a date', () => {
    expect(csv()).toContain('Back garden')
    expect(csv()).toContain('2026-09-29')
  })

  it('includes every section', () => {
    const text = csv()
    expect(text).toContain('SCHEDULE')
    expect(text).toContain('GROUND MATERIALS')
    expect(text).toContain('TOTALS')
  })

  it('quotes a name containing a comma so columns do not shift', () => {
    const tricky = doc([object({ id: 'a', assetId: 'comma, name' })])
    const text = takeoffToCsv(buildTakeoff(tricky, ASSETS, MATERIALS))
    expect(text).toContain('"Bench ""Deluxe"", oak"')
  })

  it('keeps every data row on one line', () => {
    // A stray newline inside a field is what silently corrupts an import.
    const lines = csv().split('\n')
    expect(lines.filter((l) => l.startsWith('trees')).length).toBe(1)
  })

  it('writes "varies" rather than a misleading single size', () => {
    const mixed = doc([object({ id: 'a', w: 4, h: 4 }), object({ id: 'b', w: 9, h: 4 })])
    expect(takeoffToCsv(buildTakeoff(mixed, ASSETS, MATERIALS))).toContain('varies')
  })

  it('leaves the length column empty for things that are counted, not measured', () => {
    const text = csv()
    const treeLine = text.split('\n').find((l) => l.startsWith('trees'))!
    expect(treeLine.endsWith(',')).toBe(true)
  })
})
