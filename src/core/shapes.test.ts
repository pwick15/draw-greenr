import { describe, expect, it } from 'vitest'

import { multiPolyArea, ringSignedArea } from './geometry'
import {
  circleRing,
  circleSegments,
  dragRect,
  ellipseRing,
  pathLength,
  polygonRing,
  rectRing,
  strokePath,
} from './shapes'
import type { Rect, Vec2 } from './types'

const RECT: Rect = { x: 0, y: 0, w: 4, h: 2 }

describe('rectRing', () => {
  it('produces four corners in order', () => {
    expect(rectRing(RECT)).toEqual([
      [0, 0],
      [4, 0],
      [4, 2],
      [0, 2],
    ])
  })

  it('has the area of the rect it was given', () => {
    expect(Math.abs(ringSignedArea(rectRing(RECT)))).toBeCloseTo(8, 9)
  })

  it('keeps its area when rotated', () => {
    // Rotation must be rigid: a rectangle of paving does not gain square
    // metres by being turned to line up with a wall.
    expect(Math.abs(ringSignedArea(rectRing(RECT, 37)))).toBeCloseTo(8, 9)
  })

  it('rotates about the centre, not a corner', () => {
    const ring = rectRing(RECT, 90)
    const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length
    const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length
    expect(cx).toBeCloseTo(2, 9)
    expect(cy).toBeCloseTo(1, 9)
  })
})

describe('circleSegments', () => {
  it('spends more vertices on a larger circle', () => {
    expect(circleSegments(10)).toBeGreaterThan(circleSegments(1))
  })

  it('stays within bounds at both extremes', () => {
    expect(circleSegments(0.01)).toBeGreaterThanOrEqual(12)
    expect(circleSegments(10_000)).toBeLessThanOrEqual(128)
  })

  it('survives a zero or negative radius', () => {
    expect(circleSegments(0)).toBeGreaterThanOrEqual(12)
    expect(circleSegments(-5)).toBeGreaterThanOrEqual(12)
  })
})

describe('circleRing', () => {
  it('approximates the true area closely', () => {
    const area = Math.abs(ringSignedArea(circleRing({ x: 0, y: 0 }, 3)))
    // An inscribed polygon always falls slightly short; 1% is well inside what
    // a 2 cm sagitta allows and is far below any surveying tolerance.
    expect(area).toBeGreaterThan(Math.PI * 9 * 0.99)
    expect(area).toBeLessThanOrEqual(Math.PI * 9)
  })

  it('centres on the point it was given', () => {
    const ring = circleRing({ x: 5, y: -2 }, 1)
    const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length
    const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length
    expect(cx).toBeCloseTo(5, 6)
    expect(cy).toBeCloseTo(-2, 6)
  })

  it('never repeats the closing vertex', () => {
    // A duplicated seam vertex is what broke simplifyRing before; rings here
    // are implicitly closed like everywhere else in the codebase.
    const ring = circleRing({ x: 0, y: 0 }, 2)
    expect(ring[0]).not.toEqual(ring[ring.length - 1])
  })
})

describe('ellipseRing', () => {
  it('fills the rect it is inscribed in', () => {
    const area = Math.abs(ringSignedArea(ellipseRing({ x: 0, y: 0, w: 8, h: 4 })))
    expect(area).toBeGreaterThan(Math.PI * 4 * 2 * 0.99)
    expect(area).toBeLessThanOrEqual(Math.PI * 4 * 2)
  })

  it('honours aspect ratio rather than rounding to a circle', () => {
    const ring = ellipseRing({ x: 0, y: 0, w: 10, h: 2 })
    const width = Math.max(...ring.map(([x]) => x)) - Math.min(...ring.map(([x]) => x))
    const height = Math.max(...ring.map(([, y]) => y)) - Math.min(...ring.map(([, y]) => y))
    expect(width).toBeCloseTo(10, 6)
    expect(height).toBeCloseTo(2, 6)
  })
})

describe('polygonRing', () => {
  it('produces exactly the requested number of sides', () => {
    expect(polygonRing(RECT, 6)).toHaveLength(6)
    expect(polygonRing(RECT, 8)).toHaveLength(8)
  })

  it('refuses to make a shape with no interior', () => {
    expect(polygonRing(RECT, 2).length).toBeGreaterThanOrEqual(3)
  })

  it('has less area than the ellipse that circumscribes it', () => {
    const square: Rect = { x: 0, y: 0, w: 4, h: 4 }
    expect(Math.abs(ringSignedArea(polygonRing(square, 6)))).toBeLessThan(
      Math.abs(ringSignedArea(ellipseRing(square))),
    )
  })
})

describe('dragRect', () => {
  const from: Vec2 = { x: 2, y: 3 }

  it('spans press to release', () => {
    expect(dragRect(from, { x: 6, y: 9 })).toEqual({ x: 2, y: 3, w: 4, h: 6 })
  })

  it('normalises a drag up and to the left', () => {
    expect(dragRect(from, { x: 0, y: 1 })).toEqual({ x: 0, y: 1, w: 2, h: 2 })
  })

  it('squares off on the longer side', () => {
    expect(dragRect(from, { x: 6, y: 9 }, { square: true })).toEqual({ x: 2, y: 3, w: 6, h: 6 })
  })

  it('squares into whichever quadrant the cursor went', () => {
    // Dragging up-left must grow up and left, not flip across the press point.
    expect(dragRect(from, { x: -2, y: 1 }, { square: true })).toEqual({ x: -2, y: -1, w: 4, h: 4 })
  })

  it('grows out of the press point when asked', () => {
    expect(dragRect(from, { x: 5, y: 5 }, { fromCentre: true })).toEqual({ x: -1, y: 1, w: 6, h: 4 })
  })

  it('keeps the press point at the centre however far the cursor goes', () => {
    const rect = dragRect(from, { x: -4, y: 20 }, { fromCentre: true })
    expect(rect.x + rect.w / 2).toBeCloseTo(2, 9)
    expect(rect.y + rect.h / 2).toBeCloseTo(3, 9)
  })

  it('combines square and centre into a square centred on the press', () => {
    const rect = dragRect(from, { x: 5, y: 4 }, { square: true, fromCentre: true })
    expect(rect.w).toBe(rect.h)
    expect(rect.x + rect.w / 2).toBeCloseTo(2, 9)
    expect(rect.y + rect.h / 2).toBeCloseTo(3, 9)
  })

  it('collapses to nothing when nothing was dragged', () => {
    expect(dragRect(from, from)).toEqual({ x: 2, y: 3, w: 0, h: 0 })
  })
})

describe('strokePath', () => {
  const line: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]

  it('gives a straight run the area of length times width', () => {
    expect(multiPolyArea(strokePath(line, 2))).toBeCloseTo(20, 4)
  })

  it('produces nothing for a zero or negative width', () => {
    expect(strokePath(line, 0)).toEqual([])
    expect(strokePath(line, -1)).toEqual([])
  })

  it('produces nothing from no points', () => {
    expect(strokePath([], 1)).toEqual([])
  })

  it('makes a single disc from one point only when ends are round', () => {
    const point = [{ x: 0, y: 0 }]
    expect(strokePath(point, 2, { roundEnds: true })).toHaveLength(1)
    expect(strokePath(point, 2)).toEqual([])
  })

  it('survives duplicate points, which a double-click produces', () => {
    const stuttered: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(multiPolyArea(strokePath(stuttered, 2))).toBeCloseTo(20, 4)
  })

  it('rounds the corner on a bend rather than spiking outward', () => {
    const bend: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    const area = multiPolyArea(strokePath(bend, 2))
    // Two 10 m arms at 2 m wide overlap in a 2x2 square at the corner, so the
    // union is under the naive 40. A mitre spike would push it over.
    expect(area).toBeGreaterThan(36)
    expect(area).toBeLessThan(40)
  })

  it('adds a disc at each end when asked, extending the run by the width', () => {
    const plain = multiPolyArea(strokePath(line, 2))
    const capped = multiPolyArea(strokePath(line, 2, { roundEnds: true }))
    // Two half-discs of radius 1 make a full disc. The caps are inscribed
    // polygons so they come in a few percent under pi, never over.
    expect(capped - plain).toBeGreaterThan(Math.PI * 0.95)
    expect(capped - plain).toBeLessThanOrEqual(Math.PI)
  })

  it('closes the loop when asked, leaving a hole in the middle', () => {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const result = strokePath(square, 2, { closed: true })
    // A ring path is a polygon with an inner ring, not a solid slab.
    expect(result[0].length).toBe(2)
    expect(multiPolyArea(result)).toBeLessThan(100)
  })

  it('absorbs a path that crosses itself instead of self-intersecting', () => {
    const figureEight: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]
    const area = multiPolyArea(strokePath(figureEight, 1))
    expect(Number.isFinite(area)).toBe(true)
    expect(area).toBeGreaterThan(0)
  })
})

describe('pathLength', () => {
  it('sums the segments', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ]),
    ).toBeCloseTo(15, 9)
  })

  it('counts the closing segment on a loop', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(pathLength(square)).toBeCloseTo(30, 9)
    expect(pathLength(square, true)).toBeCloseTo(40, 9)
  })

  it('is zero for fewer than two distinct points', () => {
    expect(pathLength([])).toBe(0)
    expect(pathLength([{ x: 1, y: 1 }])).toBe(0)
    expect(pathLength([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toBe(0)
  })
})
