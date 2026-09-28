import { describe, expect, it } from 'vitest'

import {
  localToWorld,
  multiPolyArea,
  objectBounds,
  pointInMultiPoly,
  polyArea,
  rotate,
  simplifyRing,
  worldToLocal,
} from './geometry'
import type { GardenObject, Ring } from './types'
import { Band } from './types'

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o1',
  assetId: 'a1',
  x: 10,
  y: 5,
  w: 4,
  h: 2,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Planting,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

describe('rotate', () => {
  it('turns +x toward +y for a positive angle (y-down means clockwise)', () => {
    const r = rotate({ x: 1, y: 0 }, 90)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(1)
  })
})

describe('worldToLocal / localToWorld', () => {
  it('round-trips for an unrotated object', () => {
    const o = object()
    const world = { x: 11.5, y: 4.25 }
    const back = localToWorld(o, worldToLocal(o, world))
    expect(back.x).toBeCloseTo(world.x)
    expect(back.y).toBeCloseTo(world.y)
  })

  it('round-trips through rotation and both flips', () => {
    const o = object({ rotation: 37, flipX: true, flipY: true })
    const world = { x: 8.2, y: 6.9 }
    const back = localToWorld(o, worldToLocal(o, world))
    expect(back.x).toBeCloseTo(world.x)
    expect(back.y).toBeCloseTo(world.y)
  })

  it('puts the centre at (w/2, h/2) in local space', () => {
    const o = object({ rotation: 23 })
    const local = worldToLocal(o, { x: o.x, y: o.y })
    expect(local.x).toBeCloseTo(o.w / 2)
    expect(local.y).toBeCloseTo(o.h / 2)
  })

  it('mirrors about the centre when flipped, leaving the centre fixed', () => {
    const plain = object()
    const flipped = object({ flipX: true })
    // A point one metre right of centre maps to one metre left of centre.
    const a = worldToLocal(plain, { x: plain.x + 1, y: plain.y })
    const b = worldToLocal(flipped, { x: flipped.x + 1, y: flipped.y })
    expect(a.x).toBeCloseTo(plain.w / 2 + 1)
    expect(b.x).toBeCloseTo(flipped.w / 2 - 1)
  })
})

describe('objectBounds', () => {
  it('matches the footprint when unrotated', () => {
    expect(objectBounds(object())).toEqual({ x: 8, y: 4, w: 4, h: 2 })
  })

  it('grows to the rotated extent', () => {
    const b = objectBounds(object({ rotation: 90 }))
    expect(b.w).toBeCloseTo(2)
    expect(b.h).toBeCloseTo(4)
    expect(b.x).toBeCloseTo(9)
    expect(b.y).toBeCloseTo(3)
  })

  it('is invariant to a 180 degree turn', () => {
    const a = objectBounds(object())
    const b = objectBounds(object({ rotation: 180 }))
    expect(b.x).toBeCloseTo(a.x)
    expect(b.w).toBeCloseTo(a.w)
  })
})

describe('area', () => {
  const square: Ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]
  const hole: Ring = [
    [2, 2],
    [4, 2],
    [4, 4],
    [2, 4],
  ]

  it('measures a simple ring', () => {
    expect(polyArea([square])).toBeCloseTo(100)
  })

  it('subtracts holes', () => {
    expect(polyArea([square, hole])).toBeCloseTo(96)
  })

  it('ignores winding direction', () => {
    expect(polyArea([[...square].reverse()])).toBeCloseTo(100)
  })

  it('sums across a multipolygon', () => {
    expect(multiPolyArea([[square], [hole]])).toBeCloseTo(104)
  })
})

describe('pointInMultiPoly', () => {
  const donut = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ] as Ring,
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
      ] as Ring,
    ],
  ]

  it('accepts a point in the body', () => {
    expect(pointInMultiPoly(donut, { x: 1, y: 1 })).toBe(true)
  })

  it('rejects a point inside the hole', () => {
    expect(pointInMultiPoly(donut, { x: 5, y: 5 })).toBe(false)
  })

  it('rejects a point outside entirely', () => {
    expect(pointInMultiPoly(donut, { x: 20, y: 20 })).toBe(false)
  })
})

describe('simplifyRing', () => {
  it('drops collinear vertices', () => {
    const ring: Ring = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    expect(simplifyRing(ring)).toHaveLength(4)
  })

  it('keeps every corner of a real shape', () => {
    const ring: Ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    expect(simplifyRing(ring)).toHaveLength(4)
  })

  it('never reduces a ring below three points', () => {
    const degenerate: Ring = [
      [0, 0],
      [5, 0],
      [10, 0],
    ]
    expect(simplifyRing(degenerate).length).toBeGreaterThanOrEqual(3)
  })
})
