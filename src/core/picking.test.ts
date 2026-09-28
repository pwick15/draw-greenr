import { describe, expect, it } from 'vitest'

import { pickInRect, pickStack, pickTop, resolvePick, zIndexOf } from './picking'
import { pointsToRing } from './surfaces'
import type { AssetDef, BandId, GardenDoc, GardenObject, Surface } from './types'
import { Band, DEFAULT_SETTINGS } from './types'

// No image decoding here, so every asset falls back to its footprint. That is
// the conservative path and exactly what runs before artwork has loaded.
const asset = (id: string, band: BandId): AssetDef => ({
  id,
  name: id,
  category: 'test',
  band,
  source: 'builtin',
  src: `/${id}.svg`,
  defaultSize: { w: 1, h: 1 },
  aspectLocked: false,
  tags: [],
})

const ASSETS = new Map<string, AssetDef>([
  ['lawnmower', asset('lawnmower', Band.Furniture)],
  ['oak', asset('oak', Band.Canopy)],
  ['bench', asset('bench', Band.Furniture)],
  ['path', asset('path', Band.Ground)],
])

const object = (id: string, assetId: string, patch: Partial<GardenObject> = {}): GardenObject => ({
  id,
  assetId,
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: ASSETS.get(assetId)!.band,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

const surface = (id: string, materialId: string, order = 0): Surface => ({
  id,
  materialId,
  geometry: [
    [
      pointsToRing([
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 },
      ]),
    ],
  ],
  order,
  opacity: 1,
  locked: false,
  hidden: false,
})

const doc = (objects: GardenObject[], surfaces: Surface[] = []): GardenDoc => ({
  id: 'doc',
  name: 'test',
  createdAt: 0,
  updatedAt: 0,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  surfaces,
  settings: { ...DEFAULT_SETTINGS },
})

const ORIGIN = { x: 0, y: 0 }

describe('zIndexOf', () => {
  it('sorts by band before manual order', () => {
    // A furniture item at the very top of its band still sits below any canopy.
    expect(zIndexOf(Band.Canopy, 0)).toBeGreaterThan(zIndexOf(Band.Furniture, 999_999))
  })
})

describe('pickStack', () => {
  it('returns overlapping objects topmost first', () => {
    const d = doc([object('bench', 'bench'), object('oak', 'oak')])
    const hits = pickStack(d, ASSETS, ORIGIN)
    expect(hits.map((h) => h.ref.id)).toEqual(['oak', 'bench'])
  })

  it('puts a tree above furniture regardless of insertion order', () => {
    const treeFirst = doc([object('oak', 'oak'), object('bench', 'bench')])
    expect(pickTop(treeFirst, ASSETS, ORIGIN)?.id).toBe('oak')
  })

  it('ranks by manual order within one band', () => {
    const d = doc([
      object('a', 'bench', { order: 0 }),
      object('b', 'bench', { order: 5 }),
      object('c', 'bench', { order: 2 }),
    ])
    expect(pickStack(d, ASSETS, ORIGIN).map((h) => h.ref.id)).toEqual(['b', 'c', 'a'])
  })

  it('never lets a surface outrank an object', () => {
    const d = doc([object('bench', 'bench')], [surface('s1', 'lawn')])
    const hits = pickStack(d, ASSETS, ORIGIN)
    expect(hits[0].ref).toEqual({ kind: 'object', id: 'bench' })
    expect(hits[1].ref).toEqual({ kind: 'surface', id: 's1' })
  })

  it('omits surfaces when asked', () => {
    const d = doc([], [surface('s1', 'lawn')])
    expect(pickStack(d, ASSETS, ORIGIN, { includeSurfaces: false })).toHaveLength(0)
  })

  it('skips hidden and locked objects by default', () => {
    const d = doc([
      object('hidden', 'bench', { hidden: true }),
      object('locked', 'bench', { locked: true }),
      object('normal', 'bench'),
    ])
    expect(pickStack(d, ASSETS, ORIGIN).map((h) => h.ref.id)).toEqual(['normal'])
  })

  it('restricts to one band when isolating', () => {
    const d = doc([object('oak', 'oak'), object('bench', 'bench')])
    const hits = pickStack(d, ASSETS, ORIGIN, { onlyBand: Band.Furniture })
    expect(hits.map((h) => h.ref.id)).toEqual(['bench'])
  })

  it('misses a point outside the footprint', () => {
    const d = doc([object('bench', 'bench')])
    expect(pickStack(d, ASSETS, { x: 100, y: 100 })).toHaveLength(0)
  })

  it('honours rotation when testing the footprint', () => {
    // A 8x1 bar turned 90 degrees covers (0, 3) but not (3, 0).
    const d = doc([object('bar', 'bench', { w: 8, h: 1, rotation: 90 })])
    expect(pickStack(d, ASSETS, { x: 0, y: 3 })).toHaveLength(1)
    expect(pickStack(d, ASSETS, { x: 3, y: 0 })).toHaveLength(0)
  })

  it('prefers the smaller target when two sit at the same depth', () => {
    const d = doc([
      object('big', 'bench', { order: 0, w: 20, h: 20 }),
      object('small', 'bench', { order: 0, w: 2, h: 2 }),
    ])
    expect(pickTop(d, ASSETS, ORIGIN)?.id).toBe('small')
  })
})

describe('resolvePick', () => {
  const stacked = doc([
    object('bottom', 'path'),
    object('middle', 'bench'),
    object('top', 'oak'),
  ])

  it('selects the topmost on a fresh click', () => {
    const result = resolvePick(stacked, ASSETS, ORIGIN, null)
    expect(result.ref?.id).toBe('top')
    expect(result.depth).toBe(1)
    expect(result.total).toBe(3)
  })

  it('walks downwards on repeated clicks at the same spot', () => {
    let cycle = null as Parameters<typeof resolvePick>[3]
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      const result = resolvePick(stacked, ASSETS, ORIGIN, cycle)
      seen.push(result.ref!.id)
      cycle = result.cycle
    }
    // Third click reaches the bottom, fourth wraps back to the top.
    expect(seen).toEqual(['top', 'middle', 'bottom', 'top'])
  })

  it('goes one deep immediately when asked (Alt-click)', () => {
    expect(resolvePick(stacked, ASSETS, ORIGIN, null, {}, true).ref?.id).toBe('middle')
  })

  it('restarts the cycle when the click moves elsewhere', () => {
    const first = resolvePick(stacked, ASSETS, ORIGIN, null)
    const second = resolvePick(stacked, ASSETS, { x: 1.5, y: 1.5 }, first.cycle)
    expect(second.ref?.id).toBe('top')
    expect(second.depth).toBe(1)
  })

  it('reports nothing over empty ground', () => {
    const result = resolvePick(stacked, ASSETS, { x: 500, y: 500 }, null)
    expect(result.ref).toBeNull()
    expect(result.total).toBe(0)
  })

  it('leaves the document untouched — selection never restacks', () => {
    const before = JSON.stringify(stacked)
    let cycle = null as Parameters<typeof resolvePick>[3]
    for (let i = 0; i < 3; i++) cycle = resolvePick(stacked, ASSETS, ORIGIN, cycle).cycle
    expect(JSON.stringify(stacked)).toBe(before)
  })
})

describe('pickInRect', () => {
  const d = doc([
    object('inside', 'bench', { x: 0, y: 0, w: 2, h: 2 }),
    object('straddling', 'bench', { x: 9, y: 0, w: 4, h: 2 }),
    object('outside', 'bench', { x: 100, y: 100, w: 2, h: 2 }),
  ])
  const rect = { x: -5, y: -5, w: 15, h: 10 }

  it('includes anything it touches by default', () => {
    expect(pickInRect(d, rect).map((r) => r.id).sort()).toEqual(['inside', 'straddling'])
  })

  it('can require full containment', () => {
    const hits = pickInRect(d, rect, { requireFullyInside: true, includeLocked: false })
    expect(hits.map((r) => r.id)).toEqual(['inside'])
  })
})
