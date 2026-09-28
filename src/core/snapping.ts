import { dist } from './geometry'
import type { Rect, Surface, Vec2 } from './types'

export interface Guide {
  axis: 'x' | 'y'
  /** World coordinate of the guide line. */
  value: number
  /** Extent of the guide along the other axis, so it spans both participants. */
  from: number
  to: number
}

export interface SnapResult {
  point: Vec2
  guides: Guide[]
  snappedX: boolean
  snappedY: boolean
}

export const snapToGrid = (v: number, size: number): number =>
  size > 0 ? Math.round(v / size) * size : v

export const snapPointToGrid = (p: Vec2, size: number): Vec2 => ({
  x: snapToGrid(p.x, size),
  y: snapToGrid(p.y, size),
})

/**
 * Align a moving rectangle to the edges and centrelines of nearby static ones.
 *
 * This is the thing that makes laying out a patio by hand tolerable: without
 * it you are nudging by eye at every zoom level, and Gardena's tool has no
 * equivalent at all.
 */
export function snapRectToRects(
  moving: Rect,
  statics: Rect[],
  tolerance: number,
): { delta: Vec2; guides: Guide[] } {
  const movingX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w]
  const movingY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h]

  let bestX: { diff: number; value: number; other: Rect } | null = null
  let bestY: { diff: number; value: number; other: Rect } | null = null

  for (const other of statics) {
    const otherX = [other.x, other.x + other.w / 2, other.x + other.w]
    const otherY = [other.y, other.y + other.h / 2, other.y + other.h]
    for (const mx of movingX) {
      for (const ox of otherX) {
        const diff = ox - mx
        if (Math.abs(diff) <= tolerance && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) {
          bestX = { diff, value: ox, other }
        }
      }
    }
    for (const my of movingY) {
      for (const oy of otherY) {
        const diff = oy - my
        if (Math.abs(diff) <= tolerance && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) {
          bestY = { diff, value: oy, other }
        }
      }
    }
  }

  const guides: Guide[] = []
  if (bestX) {
    guides.push({
      axis: 'x',
      value: bestX.value,
      from: Math.min(moving.y, bestX.other.y),
      to: Math.max(moving.y + moving.h, bestX.other.y + bestX.other.h),
    })
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      value: bestY.value,
      from: Math.min(moving.x, bestY.other.x),
      to: Math.max(moving.x + moving.w, bestY.other.x + bestY.other.w),
    })
  }

  return { delta: { x: bestX?.diff ?? 0, y: bestY?.diff ?? 0 }, guides }
}

/** Nearest existing surface vertex within `tolerance`, or null. */
export function nearestSurfaceVertex(surfaces: Surface[], p: Vec2, tolerance: number): Vec2 | null {
  let best: Vec2 | null = null
  let bestDist = tolerance
  for (const s of surfaces) {
    for (const poly of s.geometry) {
      for (const ring of poly) {
        for (const [x, y] of ring) {
          const d = dist(p, { x, y })
          if (d < bestDist) {
            bestDist = d
            best = { x, y }
          }
        }
      }
    }
  }
  return best
}

/**
 * Constrain `to` so the segment from `from` lies on a multiple of `step`
 * degrees, preserving the distance the cursor is at.
 */
export function constrainAngle(from: Vec2, to: Vec2, step: number): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return to
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  const snapped = (Math.round(deg / step) * step * Math.PI) / 180
  return { x: from.x + Math.cos(snapped) * length, y: from.y + Math.sin(snapped) * length }
}

export interface PlotSnapContext {
  surfaces: Surface[]
  draft: Vec2[]
  gridSize: number
  useGrid: boolean
  /** Constrain the new edge to 15 degree steps. */
  useAngle: boolean
  /** Tolerance in world metres, derived from a screen-pixel budget. */
  tolerance: number
  /**
   * Shortest edge worth creating, in world metres. A click this close to the
   * previous vertex is a stutter or the second half of a double-click, never a
   * deliberate two-centimetre edge.
   */
  minSpacing: number
}

export interface PlotSnapResult {
  point: Vec2
  /** The point landed on the first vertex: finish the outline. */
  closing: boolean
  /** Too close to the previous vertex to be a real edge — discard it. */
  degenerate: boolean
  kind: 'close' | 'vertex' | 'grid' | 'angle' | 'free'
}

/**
 * Snap a plot vertex. Priority matters: closing the loop beats everything,
 * then an existing vertex (so adjoining plots share corners exactly and the
 * boolean op produces a clean union), then the angle constraint, then grid.
 */
export function snapPlotPoint(raw: Vec2, ctx: PlotSnapContext): PlotSnapResult {
  const first = ctx.draft[0]
  if (first && ctx.draft.length >= 3 && dist(raw, first) <= ctx.tolerance) {
    return { point: first, closing: true, degenerate: false, kind: 'close' }
  }

  const vertex = nearestSurfaceVertex(ctx.surfaces, raw, ctx.tolerance)
  const previous = ctx.draft[ctx.draft.length - 1]

  let point: Vec2
  let kind: PlotSnapResult['kind']
  if (vertex) {
    point = vertex
    kind = 'vertex'
  } else {
    point = raw
    if (ctx.useAngle && previous) point = constrainAngle(previous, point, 15)
    if (ctx.useGrid) point = snapPointToGrid(point, ctx.gridSize)
    kind = ctx.useGrid ? 'grid' : ctx.useAngle ? 'angle' : 'free'
  }

  const degenerate = previous !== undefined && dist(previous, point) < ctx.minSpacing
  return { point, closing: false, degenerate, kind }
}
