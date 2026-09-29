import * as polyclip from 'polyclip-ts'

import { multiPolyArea, pointInPoly, simplifyMultiPoly } from './geometry'
import type { MaterialDef, MultiPoly, Pair, Ring, Surface, Vec2 } from './types'

// Exact arithmetic is the library default and is very slow. At garden scale a
// 0.1-micrometre epsilon is far below any meaningful tolerance.
polyclip.setPrecision(1e-7)

export type PaintMode = 'add' | 'subtract' | 'replace'

/** Geometry smaller than this (m²) is discarded as a boolean-op artefact. */
const MIN_FRAGMENT_AREA = 1e-4

function cleanup(mp: MultiPoly): MultiPoly {
  const simplified = simplifyMultiPoly(mp, 1e-4)
  return simplified.filter((poly) => {
    if (!poly[0] || poly[0].length < 3) return false
    return multiPolyArea([poly]) > MIN_FRAGMENT_AREA
  })
}

function safeOp(op: () => MultiPoly, fallback: MultiPoly): MultiPoly {
  try {
    return cleanup(op())
  } catch {
    // polyclip throws on some degenerate self-intersecting input. Leaving the
    // geometry untouched is always better than corrupting the plan.
    return fallback
  }
}

export const unionMulti = (a: MultiPoly, b: MultiPoly): MultiPoly =>
  a.length === 0 ? cleanup(b) : b.length === 0 ? cleanup(a) : safeOp(() => polyclip.union(a, b), a)

/**
 * Union many pieces in a single sweep.
 *
 * polyclip takes any number of operands, and one sweep over all of them is far
 * cheaper than folding pairwise — which matters for a stroked path, where a
 * long run is dozens of quads and discs that would otherwise be dozens of
 * separate boolean ops.
 */
export function unionAll(parts: readonly MultiPoly[]): MultiPoly {
  const solid = parts.filter((p) => p.length > 0)
  if (solid.length === 0) return []
  if (solid.length === 1) return cleanup(solid[0])
  return safeOp(() => polyclip.union(solid[0], ...solid.slice(1)), solid[0])
}

export const differenceMulti = (a: MultiPoly, b: MultiPoly): MultiPoly =>
  a.length === 0 || b.length === 0 ? cleanup(a) : safeOp(() => polyclip.difference(a, b), a)

export const intersectionMulti = (a: MultiPoly, b: MultiPoly): MultiPoly =>
  a.length === 0 || b.length === 0 ? [] : safeOp(() => polyclip.intersection(a, b), [])

export const ringToMulti = (ring: Ring): MultiPoly => [[ring]]

export const pointsToRing = (points: Vec2[]): Ring => points.map((p) => [p.x, p.y] as Pair)

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

export interface PaintResult {
  surfaces: Surface[]
  /** Area actually added to the target material, in m². */
  addedArea: number
}

let surfaceSeq = 0
const newSurfaceId = () => `sfc_${Date.now().toString(36)}_${(surfaceSeq++).toString(36)}`

/**
 * Apply a freshly drawn polygon to the surface stack.
 *
 * Surfaces are kept as a **partition** of the plot: one MultiPolygon per
 * material, and painting an occluding material carves its footprint out of
 * every other one. Gardena stacks each drawn shape as a separate object, which
 * is why overlapping plots there fight over z-order and why a large plan ends
 * up with hundreds of invisible quads underneath the visible ones. Here the
 * same hundred edits collapse into one shape per material — one draw call, no
 * z-fighting possible, and an honest m² readout because nothing is hidden
 * underneath anything else.
 */
export function paintSurface(
  surfaces: Surface[],
  materials: ReadonlyMap<string, MaterialDef>,
  materialId: string,
  polygon: MultiPoly,
  mode: PaintMode = 'add',
): PaintResult {
  if (polygon.length === 0) return { surfaces, addedArea: 0 }

  const material = materials.get(materialId)
  const occludes = material?.occludes ?? true
  const next: Surface[] = []
  let target = surfaces.find((s) => s.materialId === materialId)
  const beforeArea = target ? multiPolyArea(target.geometry) : 0

  for (const s of surfaces) {
    if (s.materialId === materialId) {
      let geometry: MultiPoly
      if (mode === 'add') geometry = unionMulti(s.geometry, polygon)
      else if (mode === 'subtract') geometry = differenceMulti(s.geometry, polygon)
      else geometry = cleanup(polygon)
      next.push({ ...s, geometry })
      continue
    }
    // Everything else loses whatever the new paint covers.
    if (mode !== 'subtract' && occludes && !s.locked) {
      next.push({ ...s, geometry: differenceMulti(s.geometry, polygon) })
    } else {
      next.push(s)
    }
  }

  if (!target && mode !== 'subtract') {
    const order = surfaces.reduce((m, s) => Math.max(m, s.order), -1) + 1
    target = {
      id: newSurfaceId(),
      materialId,
      geometry: cleanup(polygon),
      order,
      opacity: 1,
      locked: false,
      hidden: false,
    }
    next.push(target)
  }

  const kept = next.filter((s) => s.geometry.length > 0)
  const after = kept.find((s) => s.materialId === materialId)
  return {
    surfaces: kept.sort((a, b) => a.order - b.order),
    addedArea: (after ? multiPolyArea(after.geometry) : 0) - beforeArea,
  }
}

/**
 * Drop the one polygon containing a point.
 *
 * A material is stored as a single surface holding every patch of it, which is
 * what keeps the plan free of z-fighting — but it also means "delete this
 * patch" cannot be "delete this surface", or clicking one square of paving
 * would take every other square with it.
 *
 * Returns null when the point is not inside anything, so the caller can tell
 * "nothing was hit" apart from "the last patch was removed".
 */
export function removePolygonAt(geometry: MultiPoly, point: Vec2): MultiPoly | null {
  const index = geometry.findIndex((poly) => pointInPoly(poly, point))
  if (index < 0) return null
  return geometry.filter((_, i) => i !== index)
}

/** Erase a polygon from every material at once. */
export function eraseFromAll(surfaces: Surface[], polygon: MultiPoly): Surface[] {
  if (polygon.length === 0) return surfaces
  return surfaces
    .map((s) => (s.locked ? s : { ...s, geometry: differenceMulti(s.geometry, polygon) }))
    .filter((s) => s.geometry.length > 0)
}

// ---------------------------------------------------------------------------
// Vertex editing
// ---------------------------------------------------------------------------

export interface VertexRef {
  polyIndex: number
  ringIndex: number
  vertexIndex: number
}

export interface SurfaceVertex extends VertexRef {
  point: Vec2
  /** Hole vertices get a different handle colour. */
  isHole: boolean
}

export function surfaceVertices(surface: Surface): SurfaceVertex[] {
  const out: SurfaceVertex[] = []
  surface.geometry.forEach((poly, polyIndex) => {
    poly.forEach((ring, ringIndex) => {
      ring.forEach(([x, y], vertexIndex) => {
        out.push({ polyIndex, ringIndex, vertexIndex, point: { x, y }, isHole: ringIndex > 0 })
      })
    })
  })
  return out
}

export function moveVertex(geometry: MultiPoly, ref: VertexRef, to: Vec2): MultiPoly {
  return geometry.map((poly, pi) =>
    pi !== ref.polyIndex
      ? poly
      : poly.map((ring, ri) =>
          ri !== ref.ringIndex
            ? ring
            : ring.map((pt, vi) => (vi !== ref.vertexIndex ? pt : ([to.x, to.y] as Pair))),
        ),
  )
}

export function insertVertex(geometry: MultiPoly, ref: VertexRef, at: Vec2): MultiPoly {
  return geometry.map((poly, pi) =>
    pi !== ref.polyIndex
      ? poly
      : poly.map((ring, ri) => {
          if (ri !== ref.ringIndex) return ring
          const next = ring.slice()
          next.splice(ref.vertexIndex + 1, 0, [at.x, at.y] as Pair)
          return next
        }),
  )
}

export function removeVertex(geometry: MultiPoly, ref: VertexRef): MultiPoly {
  const ring = geometry[ref.polyIndex]?.[ref.ringIndex]
  // A ring needs three corners to enclose anything.
  if (!ring || ring.length <= 3) return geometry
  return geometry
    .map((poly, pi) =>
      pi !== ref.polyIndex
        ? poly
        : poly.map((r, ri) => (ri !== ref.ringIndex ? r : r.filter((_, vi) => vi !== ref.vertexIndex))),
    )
    .filter((poly) => poly[0] && poly[0].length >= 3)
}

/** Re-run the geometry through a self-union to repair self-intersections. */
export function healGeometry(geometry: MultiPoly): MultiPoly {
  if (geometry.length === 0) return geometry
  return safeOp(() => polyclip.union(geometry), geometry)
}

export function translateGeometry(geometry: MultiPoly, dx: number, dy: number): MultiPoly {
  return geometry.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x + dx, y + dy] as Pair)))
}
