import { describe, expect, it } from 'vitest'

import { objectBounds } from './geometry'
import {
  MIN_SIZE,
  boxHandlePoint,
  handlePoint,
  oppositeHandle,
  resizeGroup,
  resizeObject,
  rotateAbout,
  selectionBounds,
  snapAngle,
  type ResizeOptions,
} from './transform'
import type { GardenObject } from './types'
import { Band } from './types'

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o1',
  assetId: 'a1',
  x: 0,
  y: 0,
  w: 10,
  h: 4,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Furniture,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

const FREE: ResizeOptions = { keepAspect: false, fromCentre: false, snap: 0 }

describe('handlePoint', () => {
  it('places handles on the footprint corners', () => {
    const o = object()
    expect(handlePoint(o, 'nw')).toEqual({ x: -5, y: -2 })
    expect(handlePoint(o, 'se')).toEqual({ x: 5, y: 2 })
    expect(handlePoint(o, 'n')).toEqual({ x: 0, y: -2 })
  })

  it('carries handles around with the object when it rotates', () => {
    const p = handlePoint(object({ rotation: 90 }), 'e')
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(5)
  })
})

describe('oppositeHandle', () => {
  it('pairs each handle with its diagonal', () => {
    expect(oppositeHandle('nw')).toBe('se')
    expect(oppositeHandle('e')).toBe('w')
    expect(oppositeHandle(oppositeHandle('sw'))).toBe('sw')
  })
})

describe('resizeObject', () => {
  it('pins the opposite edge when dragging east', () => {
    const o = object()
    const box = resizeObject(o, 'e', { x: 15, y: 0 }, FREE)
    expect(box.w).toBeCloseTo(20)
    expect(box.h).toBeCloseTo(4)
    // West edge stays at -5.
    expect(box.x - box.w / 2).toBeCloseTo(-5)
  })

  it('pins the opposite corner when dragging a corner', () => {
    const o = object()
    const box = resizeObject(o, 'se', { x: 1, y: 6 }, FREE)
    expect(box.x - box.w / 2).toBeCloseTo(-5)
    expect(box.y - box.h / 2).toBeCloseTo(-2)
    expect(box.w).toBeCloseTo(6)
    expect(box.h).toBeCloseTo(8)
  })

  it('resizes along the object axis, not the screen axis, when rotated', () => {
    // Turned 90 degrees, dragging the "east" handle should still grow width.
    const o = object({ rotation: 90 })
    const box = resizeObject(o, 'e', { x: 0, y: 15 }, FREE)
    expect(box.w).toBeCloseTo(20)
    expect(box.h).toBeCloseTo(4)
  })

  it('preserves the aspect ratio when asked', () => {
    const o = object()
    const box = resizeObject(o, 'se', { x: 15, y: 2 }, { ...FREE, keepAspect: true })
    expect(box.w / box.h).toBeCloseTo(10 / 4)
  })

  it('grows an edge handle symmetrically under aspect lock', () => {
    const box = resizeObject(object(), 'e', { x: 15, y: 0 }, { ...FREE, keepAspect: true })
    expect(box.w / box.h).toBeCloseTo(10 / 4)
  })

  it('keeps the centre fixed when resizing from the centre', () => {
    const box = resizeObject(object(), 'e', { x: 12, y: 0 }, { ...FREE, fromCentre: true })
    expect(box.x).toBeCloseTo(0)
    expect(box.y).toBeCloseTo(0)
    expect(box.w).toBeCloseTo(24)
  })

  it('clamps to a minimum rather than inverting', () => {
    const box = resizeObject(object(), 'e', { x: -5, y: 0 }, FREE)
    expect(box.w).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(box.w).toBeLessThan(0.2)
  })

  it('rounds to the grid when snapping is on', () => {
    const box = resizeObject(object(), 'e', { x: 12.4, y: 0 }, { ...FREE, snap: 0.5 })
    expect(box.w).toBeCloseTo(17.5)
  })

  it('leaves the other axis alone for an edge handle', () => {
    const box = resizeObject(object(), 's', { x: 99, y: 10 }, FREE)
    expect(box.w).toBeCloseTo(10)
    expect(box.h).toBeCloseTo(12)
  })
})

describe('resizeGroup', () => {
  const objects = [
    object({ id: 'a', x: -5, y: 0, w: 2, h: 2 }),
    object({ id: 'b', x: 5, y: 0, w: 2, h: 2 }),
  ]
  const box = selectionBounds(objects)!

  it('bounds the whole selection', () => {
    expect(box).toEqual({ x: -6, y: -1, w: 12, h: 2 })
  })

  it('scales members about the anchored corner', () => {
    // Drag the east edge from x=6 out to x=18: a 2x scale about x=-6.
    const result = resizeGroup(objects, box, 'e', { x: 18, y: 0 }, FREE)
    expect(result.get('a')!.x).toBeCloseTo(-4) // -6 + (-5 - -6) * 2
    expect(result.get('b')!.x).toBeCloseTo(16) // -6 + ( 5 - -6) * 2
    expect(result.get('a')!.w).toBeCloseTo(4)
    expect(result.get('a')!.h).toBeCloseTo(2) // untouched axis
  })

  it('leaves rotations untouched', () => {
    const rotated = [object({ id: 'a', rotation: 33, x: -5, w: 2, h: 2 })]
    const bounds = selectionBounds(rotated)!
    const result = resizeGroup(rotated, bounds, 'e', { x: 10, y: 0 }, FREE)
    // resizeGroup only reports boxes; rotation is deliberately not in them.
    expect(result.get('a')).not.toHaveProperty('rotation')
  })
})

describe('rotateAbout', () => {
  it('turns a single object in place about its own centre', () => {
    const o = object({ x: 3, y: 4 })
    const result = rotateAbout([o], { x: 3, y: 4 }, 45)
    expect(result.get('o1')!.x).toBeCloseTo(3)
    expect(result.get('o1')!.y).toBeCloseTo(4)
    expect(result.get('o1')!.rotation).toBeCloseTo(45)
  })

  it('swings a group member around the pivot', () => {
    const o = object({ x: 10, y: 0 })
    const result = rotateAbout([o], { x: 0, y: 0 }, 90)
    expect(result.get('o1')!.x).toBeCloseTo(0)
    expect(result.get('o1')!.y).toBeCloseTo(10)
    expect(result.get('o1')!.rotation).toBeCloseTo(90)
  })

  it('returns to the start after a full turn', () => {
    const o = object({ x: 7, y: -2, rotation: 15 })
    const result = rotateAbout([o], { x: 1, y: 1 }, 360)
    expect(result.get('o1')!.x).toBeCloseTo(7)
    expect(result.get('o1')!.y).toBeCloseTo(-2)
  })
})

describe('snapAngle', () => {
  it('rounds to the nearest step', () => {
    expect(snapAngle(17, 15)).toBe(15)
    expect(snapAngle(23, 15)).toBe(30)
    expect(snapAngle(-7, 15)).toBe(-0)
  })

  it('is a no-op for a zero step', () => {
    expect(snapAngle(17.3, 0)).toBe(17.3)
  })
})

describe('boxHandlePoint', () => {
  it('matches objectBounds for an unrotated object', () => {
    const o = object()
    const bounds = objectBounds(o)
    expect(boxHandlePoint(bounds, 'nw')).toEqual(handlePoint(o, 'nw'))
    expect(boxHandlePoint(bounds, 'se')).toEqual(handlePoint(o, 'se'))
  })
})
