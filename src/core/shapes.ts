import { unionAll } from './surfaces'
import type { MultiPoly, Pair, Rect, Ring, Vec2 } from './types'

/**
 * Ready-made outlines for the surface tools.
 *
 * Drawing a rectangle of paving vertex by vertex is busywork, and a circle is
 * worse — so the plot tool grows a set of shapes that produce a ring directly.
 * Everything here is a plain outline handed straight to `paintSurface`, which
 * means stamps add, subtract and occlude exactly like a hand-drawn plot with no
 * special cases anywhere downstream.
 */

/**
 * How far a chord may sag from the true arc, in metres.
 *
 * Segment count is derived from this rather than fixed, so a 40 cm pot and a
 * 12 m pond each get the vertices they need. A fixed count would either fur up
 * small shapes with detail nobody can see or leave large ones visibly faceted.
 */
const CHORD_SAGITTA = 0.02
const MIN_SEGMENTS = 12
const MAX_SEGMENTS = 128

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

export function circleSegments(radius: number): number {
  if (!(radius > 0)) return MIN_SEGMENTS
  const step = Math.acos(clamp(1 - CHORD_SAGITTA / radius, -1, 1))
  if (!(step > 0)) return MAX_SEGMENTS
  return clamp(Math.ceil(Math.PI / step), MIN_SEGMENTS, MAX_SEGMENTS)
}

/** Rotate a point about a centre, degrees clockwise to match object rotation. */
function rotate(p: Vec2, centre: Vec2, cos: number, sin: number): Pair {
  const dx = p.x - centre.x
  const dy = p.y - centre.y
  return [centre.x + dx * cos - dy * sin, centre.y + dx * sin + dy * cos]
}

export function rectRing(rect: Rect, rotation = 0): Ring {
  const { x, y, w, h } = rect
  const corners: Vec2[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
  if (!rotation) return corners.map((p): Pair => [p.x, p.y])
  const centre = { x: x + w / 2, y: y + h / 2 }
  const a = (rotation * Math.PI) / 180
  return corners.map((p) => rotate(p, centre, Math.cos(a), Math.sin(a)))
}

/** An ellipse inscribed in the rect, so it drags out exactly like a rectangle. */
export function ellipseRing(rect: Rect, rotation = 0): Ring {
  const rx = rect.w / 2
  const ry = rect.h / 2
  const centre = { x: rect.x + rx, y: rect.y + ry }
  const n = circleSegments(Math.max(rx, ry))
  const a = (rotation * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)

  const ring: Ring = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const px = rx * Math.cos(t)
    const py = ry * Math.sin(t)
    ring.push([centre.x + px * cos - py * sin, centre.y + px * sin + py * cos])
  }
  return ring
}

export const circleRing = (centre: Vec2, radius: number): Ring =>
  ellipseRing({ x: centre.x - radius, y: centre.y - radius, w: radius * 2, h: radius * 2 })

/** A regular polygon inscribed in the rect — hexagonal paving, octagonal beds. */
export function polygonRing(rect: Rect, sides: number, rotation = 0): Ring {
  const n = Math.max(3, Math.round(sides))
  const rx = rect.w / 2
  const ry = rect.h / 2
  const centre = { x: rect.x + rx, y: rect.y + ry }
  // Start at the top so an odd-sided polygon sits point-up, which is how
  // anyone drawing a hexagon expects it to land.
  const offset = -Math.PI / 2 + (rotation * Math.PI) / 180

  const ring: Ring = []
  for (let i = 0; i < n; i++) {
    const t = offset + (i / n) * Math.PI * 2
    ring.push([centre.x + rx * Math.cos(t), centre.y + ry * Math.sin(t)])
  }
  return ring
}

export interface DragRectOptions {
  /** Force equal sides — a square, or a circle once inscribed. */
  square?: boolean
  /** Treat the press point as the centre rather than a corner. */
  fromCentre?: boolean
}

/**
 * The rect a press-drag describes, in the same idiom as resizing an object:
 * Shift keeps it square, Alt grows it out of the press point.
 */
export function dragRect(start: Vec2, current: Vec2, options: DragRectOptions = {}): Rect {
  let dx = current.x - start.x
  let dy = current.y - start.y

  if (options.square) {
    // Take the longer side and keep each axis pointing the way it was dragged,
    // so the shape follows the cursor into any quadrant.
    const size = Math.max(Math.abs(dx), Math.abs(dy))
    dx = dx < 0 ? -size : size
    dy = dy < 0 ? -size : size
  }

  if (options.fromCentre) {
    const w = Math.abs(dx)
    const h = Math.abs(dy)
    return { x: start.x - w, y: start.y - h, w: w * 2, h: h * 2 }
  }

  return {
    x: Math.min(start.x, start.x + dx),
    y: Math.min(start.y, start.y + dy),
    w: Math.abs(dx),
    h: Math.abs(dy),
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Points closer together than this contribute no direction and are dropped. */
const MIN_SEGMENT_LENGTH = 1e-9

function dedupeConsecutive(points: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > MIN_SEGMENT_LENGTH) out.push(p)
  }
  return out
}

export interface StrokeOptions {
  /** Round the two ends off as well as the corners. */
  roundEnds?: boolean
  /** Treat the points as a closed loop — a path round an island bed. */
  closed?: boolean
}

/**
 * Give a polyline a width, producing a surface outline.
 *
 * Built as one quad per segment plus a disc at every joint, all unioned in a
 * single sweep. The obvious alternative — offsetting the centreline into a
 * single outline — needs mitre joins, and a mitre on a tight bend overshoots
 * enormously: on a winding garden path that shows up as a spike of gravel
 * shooting off across the lawn. Discs give round joins for nothing, and the
 * union quietly absorbs a path that doubles back or crosses itself, which the
 * offset approach turns into self-intersecting garbage.
 */
export function strokePath(
  points: readonly Vec2[],
  width: number,
  options: StrokeOptions = {},
): MultiPoly {
  const half = width / 2
  if (!(half > 0)) return []

  const pts = dedupeConsecutive(points)
  if (pts.length === 0) return []
  if (pts.length === 1) return options.roundEnds ? [[circleRing(pts[0], half)]] : []

  const closed = options.closed === true && pts.length > 2
  const parts: MultiPoly[] = []

  const segmentCount = closed ? pts.length : pts.length - 1
  for (let i = 0; i < segmentCount; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len <= MIN_SEGMENT_LENGTH) continue
    // Left-hand normal, scaled to half the width.
    const nx = (-dy / len) * half
    const ny = (dx / len) * half
    parts.push([
      [
        [
          [a.x + nx, a.y + ny],
          [b.x + nx, b.y + ny],
          [b.x - nx, b.y - ny],
          [a.x - nx, a.y - ny],
        ],
      ],
    ])
  }

  // Joints get a disc; the two ends only if round ends were asked for.
  const from = closed || options.roundEnds ? 0 : 1
  const to = closed || options.roundEnds ? pts.length - 1 : pts.length - 2
  for (let i = from; i <= to; i++) parts.push([[circleRing(pts[i], half)]])

  return unionAll(parts)
}

/** Centreline length of a path, for the status readout while drawing. */
export function pathLength(points: readonly Vec2[], closed = false): number {
  const pts = dedupeConsecutive(points)
  if (pts.length < 2) return 0
  let total = 0
  const segments = closed ? pts.length : pts.length - 1
  for (let i = 0; i < segments; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}
