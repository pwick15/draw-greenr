import type { GardenObject, MultiPoly, Pair, Poly, Rect, Ring, Vec2 } from './types'

export const DEG = Math.PI / 180

export const vec = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export function rotate(p: Vec2, deg: number): Vec2 {
  const r = deg * DEG
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

/** Normalise degrees into [0, 360). */
export function normAngle(deg: number): number {
  const a = deg % 360
  return a < 0 ? a + 360 : a
}

// ---------------------------------------------------------------------------
// Object transforms
// ---------------------------------------------------------------------------

/**
 * Map a world point into an object's unrotated local space, where (0,0) is the
 * top-left of its footprint and (w,h) the bottom-right. Flips are applied so
 * the result always indexes the source artwork directly.
 */
export function worldToLocal(o: GardenObject, p: Vec2): Vec2 {
  const d = rotate({ x: p.x - o.x, y: p.y - o.y }, -o.rotation)
  const lx = o.flipX ? -d.x : d.x
  const ly = o.flipY ? -d.y : d.y
  return { x: lx + o.w / 2, y: ly + o.h / 2 }
}

export function localToWorld(o: GardenObject, p: Vec2): Vec2 {
  let dx = p.x - o.w / 2
  let dy = p.y - o.h / 2
  if (o.flipX) dx = -dx
  if (o.flipY) dy = -dy
  const r = rotate({ x: dx, y: dy }, o.rotation)
  return { x: r.x + o.x, y: r.y + o.y }
}

/** The four corners of an object's footprint in world space, clockwise from top-left. */
export function objectCorners(o: GardenObject): [Vec2, Vec2, Vec2, Vec2] {
  const hw = o.w / 2
  const hh = o.h / 2
  const pts: Vec2[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
  return pts.map((p) => {
    const r = rotate(p, o.rotation)
    return { x: r.x + o.x, y: r.y + o.y }
  }) as [Vec2, Vec2, Vec2, Vec2]
}

/** World-space axis-aligned bounds of a (possibly rotated) object. */
export function objectBounds(o: GardenObject): Rect {
  if (o.rotation === 0) {
    return { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h }
  }
  const c = objectCorners(o)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of c) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ---------------------------------------------------------------------------
// Rect helpers
// ---------------------------------------------------------------------------

export const rectContains = (r: Rect, p: Vec2): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

export const rectIntersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** True when `inner` lies entirely inside `outer`. */
export const rectContainsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h

export function rectFromPoints(a: Vec2, b: Vec2): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    if (r.x + r.w > maxX) maxX = r.x + r.w
    if (r.y + r.h > maxY) maxY = r.y + r.h
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 }
}

// ---------------------------------------------------------------------------
// Polygon helpers
// ---------------------------------------------------------------------------

export function ringBounds(ring: Ring): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function multiPolyBounds(mp: MultiPoly): Rect | null {
  const rects: Rect[] = []
  for (const poly of mp) if (poly[0]?.length) rects.push(ringBounds(poly[0]))
  return unionRects(rects)
}

/** Signed area; positive means clockwise in a y-down coordinate system. */
export function ringSignedArea(ring: Ring): number {
  let sum = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

/** Area of a polygon in m², outer ring minus holes. */
export function polyArea(poly: Poly): number {
  if (!poly.length) return 0
  let area = Math.abs(ringSignedArea(poly[0]))
  for (let i = 1; i < poly.length; i++) area -= Math.abs(ringSignedArea(poly[i]))
  return Math.max(0, area)
}

export function multiPolyArea(mp: MultiPoly): number {
  let total = 0
  for (const poly of mp) total += polyArea(poly)
  return total
}

export function ringPerimeter(ring: Ring): number {
  let total = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    total += Math.hypot(x2 - x1, y2 - y1)
  }
  return total
}

/** Crossing-number point-in-ring test. */
export function pointInRing(ring: Ring, p: Vec2): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Inside the outer ring and outside every hole. */
export function pointInPoly(poly: Poly, p: Vec2): boolean {
  if (!poly.length || !pointInRing(poly[0], p)) return false
  for (let i = 1; i < poly.length; i++) if (pointInRing(poly[i], p)) return false
  return true
}

export function pointInMultiPoly(mp: MultiPoly, p: Vec2): boolean {
  for (const poly of mp) if (pointInPoly(poly, p)) return true
  return false
}

/** Shortest distance from `p` to the segment `a`-`b`, plus the closest point. */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number; dist: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1)
  const point = { x: a.x + t * dx, y: a.y + t * dy }
  return { point, t, dist: dist(p, point) }
}

export const toPair = (p: Vec2): Pair => [p.x, p.y]
export const fromPair = ([x, y]: Pair): Vec2 => ({ x, y })

/**
 * Strip an explicitly repeated closing vertex.
 *
 * polyclip returns rings closed (`[a, b, c, a]`), while everything here treats
 * a ring as implicitly closed. Left in, the duplicate creates a zero-length
 * edge that collinearity tests read as degenerate — which silently deletes a
 * real corner.
 */
export function openRing(ring: Ring): Ring {
  const n = ring.length
  if (n < 2) return ring
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[n - 1]
  return Math.abs(fx - lx) < 1e-12 && Math.abs(fy - ly) < 1e-12 ? ring.slice(0, -1) : ring
}

/**
 * Drop vertices that sit almost exactly on the line between their neighbours.
 * Boolean ops leave a lot of these behind and they slow every later op down.
 */
/**
 * Smallest convex ring enclosing a set of points — Andrew's monotone chain.
 *
 * Returned open, like every other ring here, and wound the same way regardless
 * of the input order so area and point-in-ring tests behave predictably.
 */
export function convexHull(points: readonly Vec2[]): Ring {
  if (points.length < 3) return points.map(toPair)

  const sorted = points
    .map(toPair)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter((p, i, list) => i === 0 || p[0] !== list[i - 1][0] || p[1] !== list[i - 1][1])
  if (sorted.length < 3) return sorted

  const cross = (o: Pair, a: Pair, b: Pair): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const half = (input: Pair[]): Pair[] => {
    const chain: Pair[] = []
    for (const p of input) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) {
        chain.pop()
      }
      chain.push(p)
    }
    // The last point of each half is the first of the other, so drop it.
    return chain.slice(0, -1)
  }

  return [...half(sorted), ...half(sorted.slice().reverse())]
}

export function simplifyRing(input: Ring, epsilon = 1e-4): Ring {
  const ring = openRing(input)
  if (ring.length < 4) return ring
  const out: Ring = []
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]
    const cur = ring[i]
    const next = ring[(i + 1) % n]
    const cross =
      (cur[0] - prev[0]) * (next[1] - prev[1]) - (cur[1] - prev[1]) * (next[0] - prev[0])
    const spanLen = Math.hypot(next[0] - prev[0], next[1] - prev[1])
    // `cross / spanLen` is the perpendicular distance from `cur` to prev->next.
    if (spanLen < epsilon || Math.abs(cross) / spanLen > epsilon) out.push(cur)
  }
  return out.length >= 3 ? out : ring
}

export function simplifyMultiPoly(mp: MultiPoly, epsilon = 1e-4): MultiPoly {
  return mp
    .map((poly) => poly.map((ring) => simplifyRing(ring, epsilon)).filter((r) => r.length >= 3))
    .filter((poly) => poly.length > 0)
}
