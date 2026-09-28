import { describe, expect, it } from 'vitest'

import { constrainAngle, snapPlotPoint, snapRectToRects, type PlotSnapContext } from './snapping'
import { pointsToRing } from './surfaces'
import type { Surface, Vec2 } from './types'

const surface = (points: Vec2[]): Surface => ({
  id: 's1',
  materialId: 'lawn',
  geometry: [[pointsToRing(points)]],
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
})

const ctx = (patch: Partial<PlotSnapContext> = {}): PlotSnapContext => ({
  surfaces: [],
  draft: [],
  gridSize: 1,
  useGrid: false,
  useAngle: false,
  tolerance: 0.25,
  minSpacing: 0.2,
  ...patch,
})

const TRIANGLE: Vec2[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
]

describe('snapPlotPoint closing', () => {
  it('closes when the click lands on the first vertex', () => {
    const result = snapPlotPoint({ x: 0.1, y: 0.1 }, ctx({ draft: TRIANGLE }))
    expect(result.closing).toBe(true)
    expect(result.point).toEqual({ x: 0, y: 0 })
  })

  it('does not close with fewer than three vertices down', () => {
    const draft = TRIANGLE.slice(0, 2)
    expect(snapPlotPoint({ x: 0.1, y: 0.1 }, ctx({ draft })).closing).toBe(false)
  })

  it('does not close for a click outside the tolerance', () => {
    expect(snapPlotPoint({ x: 2, y: 2 }, ctx({ draft: TRIANGLE })).closing).toBe(false)
  })
})

describe('snapPlotPoint degeneracy', () => {
  // The guard that stops a fast double-click leaving a millimetre-long edge.
  it('rejects a point on top of the previous vertex', () => {
    const result = snapPlotPoint({ x: 10.01, y: 10.01 }, ctx({ draft: TRIANGLE }))
    expect(result.degenerate).toBe(true)
  })

  it('accepts a point a real distance away', () => {
    const result = snapPlotPoint({ x: 10, y: 14 }, ctx({ draft: TRIANGLE }))
    expect(result.degenerate).toBe(false)
  })

  it('never calls the very first vertex degenerate', () => {
    expect(snapPlotPoint({ x: 3, y: 3 }, ctx()).degenerate).toBe(false)
  })

  it('scales with the caller-supplied spacing, which is zoom-dependent', () => {
    const point = { x: 10, y: 10.5 }
    expect(snapPlotPoint(point, ctx({ draft: TRIANGLE, minSpacing: 0.2 })).degenerate).toBe(false)
    expect(snapPlotPoint(point, ctx({ draft: TRIANGLE, minSpacing: 2 })).degenerate).toBe(true)
  })
})

describe('snapPlotPoint snapping', () => {
  it('prefers an existing surface vertex, so adjoining plots share corners', () => {
    const surfaces = [surface([{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }])]
    const result = snapPlotPoint({ x: 20.1, y: 20.1 }, ctx({ surfaces }))
    expect(result.kind).toBe('vertex')
    expect(result.point).toEqual({ x: 20, y: 20 })
  })

  it('rounds to the grid when enabled', () => {
    const result = snapPlotPoint({ x: 3.4, y: 6.7 }, ctx({ useGrid: true, gridSize: 1 }))
    expect(result.point).toEqual({ x: 3, y: 7 })
    expect(result.kind).toBe('grid')
  })

  it('constrains the edge angle when enabled', () => {
    const draft = [{ x: 0, y: 0 }]
    // ~5.7 degrees off axis, inside the 7.5 degree half-step, so it flattens.
    const flat = snapPlotPoint({ x: 10, y: 1 }, ctx({ draft, useAngle: true, minSpacing: 0 }))
    expect(flat.point.y).toBeCloseTo(0, 6)
    expect(flat.kind).toBe('angle')

    // ~9.7 degrees is past the half-step, so it snaps up to 15, not down to 0.
    const stepped = snapPlotPoint({ x: 10, y: 1.7 }, ctx({ draft, useAngle: true, minSpacing: 0 }))
    const angle = (Math.atan2(stepped.point.y, stepped.point.x) * 180) / Math.PI
    expect(angle).toBeCloseTo(15, 6)
  })

  it('lets an existing vertex win over the grid', () => {
    const surfaces = [surface([{ x: 20.3, y: 20.3 }, { x: 30, y: 20 }, { x: 30, y: 30 }])]
    const result = snapPlotPoint({ x: 20.35, y: 20.35 }, ctx({ surfaces, useGrid: true }))
    expect(result.point).toEqual({ x: 20.3, y: 20.3 })
  })
})

describe('constrainAngle', () => {
  it('keeps the cursor distance while snapping the direction', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 10, y: 1 }
    const result = constrainAngle(from, to, 15)
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(Math.hypot(10, 1))
    expect(result.y).toBeCloseTo(0, 6)
  })

  it('returns the point unchanged at zero length', () => {
    expect(constrainAngle({ x: 5, y: 5 }, { x: 5, y: 5 }, 15)).toEqual({ x: 5, y: 5 })
  })
})

describe('snapRectToRects', () => {
  const moving = { x: 0, y: 0, w: 4, h: 2 }

  it('aligns a near-matching left edge', () => {
    const snap = snapRectToRects({ ...moving, x: 9.9 }, [{ x: 10, y: 50, w: 4, h: 2 }], 0.25)
    expect(snap.delta.x).toBeCloseTo(0.1)
    expect(snap.guides.some((g) => g.axis === 'x')).toBe(true)
  })

  it('ignores anything outside the tolerance', () => {
    const snap = snapRectToRects(moving, [{ x: 40, y: 40, w: 4, h: 2 }], 0.25)
    expect(snap.delta).toEqual({ x: 0, y: 0 })
    expect(snap.guides).toHaveLength(0)
  })

  it('snaps centre to centre', () => {
    // Moving centre x = 2; static centre x = 2.15.
    const snap = snapRectToRects(moving, [{ x: 0.15, y: 30, w: 4, h: 2 }], 0.25)
    expect(snap.delta.x).toBeCloseTo(0.15)
  })

  it('picks the closest candidate when several are in range', () => {
    const snap = snapRectToRects(moving, [
      { x: 0.2, y: 30, w: 4, h: 2 },
      { x: 0.05, y: 30, w: 4, h: 2 },
    ], 0.25)
    expect(snap.delta.x).toBeCloseTo(0.05)
  })
})
