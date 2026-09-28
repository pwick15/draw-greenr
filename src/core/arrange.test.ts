import { describe, expect, it } from 'vitest'

import { alignObjects, currentGaps, distributeObjects, spaceObjects } from './arrange'
import { objectBounds } from './geometry'
import type { GardenObject } from './types'
import { Band } from './types'

const object = (id: string, x: number, y: number, w = 2, h = 2, rotation = 0): GardenObject => ({
  id,
  assetId: 'a',
  x,
  y,
  w,
  h,
  rotation,
  flipX: false,
  flipY: false,
  band: Band.Planting,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
})

/** Apply the returned centres so assertions can read final bounds. */
const applied = (objects: GardenObject[], moves: Map<string, { x: number; y: number }>) =>
  objects.map((o) => {
    const move = moves.get(o.id)
    return move ? { ...o, x: move.x, y: move.y } : o
  })

describe('alignObjects', () => {
  const objects = [object('a', 0, 0, 2, 2), object('b', 10, 5, 4, 4), object('c', 20, 10, 2, 6)]

  it('aligns left edges to the leftmost', () => {
    const result = applied(objects, alignObjects(objects, 'left'))
    const lefts = result.map((o) => objectBounds(o).x)
    expect(lefts.every((l) => Math.abs(l - lefts[0]) < 1e-9)).toBe(true)
    expect(lefts[0]).toBeCloseTo(-1)
  })

  it('aligns right edges to the rightmost', () => {
    const result = applied(objects, alignObjects(objects, 'right'))
    const rights = result.map((o) => objectBounds(o).x + objectBounds(o).w)
    expect(rights.every((r) => Math.abs(r - rights[0]) < 1e-9)).toBe(true)
    expect(rights[0]).toBeCloseTo(21)
  })

  it('aligns horizontal centres', () => {
    const result = applied(objects, alignObjects(objects, 'centreX'))
    const centres = result.map((o) => o.x)
    expect(centres.every((c) => Math.abs(c - centres[0]) < 1e-9)).toBe(true)
  })

  it('aligns top edges without touching x', () => {
    const result = applied(objects, alignObjects(objects, 'top'))
    const tops = result.map((o) => objectBounds(o).y)
    expect(tops.every((t) => Math.abs(t - tops[0]) < 1e-9)).toBe(true)
    expect(result.map((o) => o.x)).toEqual(objects.map((o) => o.x))
  })

  it('uses the rotated bounding box, not the raw footprint', () => {
    // An 8x1 bar turned 90 degrees is 1 wide and 8 tall on screen.
    const rotated = [object('a', 0, 0, 2, 2), object('b', 10, 0, 8, 1, 90)]
    const result = applied(rotated, alignObjects(rotated, 'left'))
    const lefts = result.map((o) => objectBounds(o).x)
    expect(lefts[0]).toBeCloseTo(lefts[1])
  })

  it('does nothing with fewer than two objects', () => {
    expect(alignObjects([object('a', 0, 0)], 'left').size).toBe(0)
  })
})

describe('distributeObjects', () => {
  it('equalises the gaps between differently sized objects', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 6, 0, 6, 2), object('c', 20, 0, 2, 2)]
    const result = applied(objects, distributeObjects(objects, 'x', 'gaps'))
    const gaps = currentGaps(result, 'x')
    expect(gaps).toHaveLength(2)
    expect(gaps[0]).toBeCloseTo(gaps[1])
  })

  it('leaves the outermost two exactly where they were', () => {
    const objects = [object('a', 0, 0), object('b', 5, 0), object('c', 20, 0)]
    const moves = distributeObjects(objects, 'x', 'gaps')
    expect(moves.has('a')).toBe(false)
    expect(moves.has('c')).toBe(false)
    expect(moves.has('b')).toBe(true)
  })

  it('equalises centre spacing in centres mode', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 5, 0, 6, 2), object('c', 20, 0, 2, 2)]
    const result = applied(objects, distributeObjects(objects, 'x', 'centres'))
    const centres = result.map((o) => o.x).sort((p, q) => p - q)
    expect(centres[1] - centres[0]).toBeCloseTo(centres[2] - centres[1])
  })

  it('works on the vertical axis', () => {
    const objects = [object('a', 0, 0), object('b', 0, 3), object('c', 0, 20)]
    const result = applied(objects, distributeObjects(objects, 'y', 'gaps'))
    const gaps = currentGaps(result, 'y')
    expect(gaps[0]).toBeCloseTo(gaps[1])
  })

  it('needs three objects to mean anything', () => {
    const objects = [object('a', 0, 0), object('b', 10, 0)]
    expect(distributeObjects(objects, 'x').size).toBe(0)
  })

  it('handles input given in the wrong order', () => {
    const objects = [object('c', 20, 0), object('a', 0, 0), object('b', 5, 0)]
    const result = applied(objects, distributeObjects(objects, 'x', 'gaps'))
    const gaps = currentGaps(result, 'x')
    expect(gaps[0]).toBeCloseTo(gaps[1])
  })
})

describe('spaceObjects', () => {
  it('sets an exact edge-to-edge gap', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 9, 0, 4, 2), object('c', 30, 0, 2, 2)]
    const result = applied(objects, spaceObjects(objects, 'x', 0.6))
    expect(currentGaps(result, 'x').every((g) => Math.abs(g - 0.6) < 1e-9)).toBe(true)
  })

  it('anchors on the first object', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 9, 0, 2, 2)]
    const result = applied(objects, spaceObjects(objects, 'x', 1))
    expect(result[0].x).toBe(0)
    expect(objectBounds(result[1]).x).toBeCloseTo(2)
  })

  it('accepts a zero gap, butting objects together', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 9, 0, 2, 2), object('c', 20, 0, 2, 2)]
    const result = applied(objects, spaceObjects(objects, 'x', 0))
    expect(currentGaps(result, 'x').every((g) => Math.abs(g) < 1e-9)).toBe(true)
  })

  it('can overlap objects with a negative gap', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 9, 0, 2, 2)]
    const result = applied(objects, spaceObjects(objects, 'x', -0.5))
    expect(currentGaps(result, 'x')[0]).toBeCloseTo(-0.5)
  })
})

describe('currentGaps', () => {
  it('measures edge to edge, not centre to centre', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 5, 0, 2, 2)]
    // Centres 5 apart, each 2 wide, so the gap is 3.
    expect(currentGaps(objects, 'x')[0]).toBeCloseTo(3)
  })

  it('reports a negative gap for overlapping objects', () => {
    const objects = [object('a', 0, 0, 2, 2), object('b', 1, 0, 2, 2)]
    expect(currentGaps(objects, 'x')[0]).toBeCloseTo(-1)
  })

  it('is empty for a single object', () => {
    expect(currentGaps([object('a', 0, 0)], 'x')).toEqual([])
  })
})
