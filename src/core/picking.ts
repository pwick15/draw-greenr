import { objectBounds, pointInMultiPoly, rectContains, expandRect } from './geometry'
import { getImage, sampleMask } from './imageCache'
import type { AssetDef, GardenDoc, GardenObject, SelectionRef, Surface, Vec2 } from './types'

/** Room for a million manual positions inside each band. */
export const Z_BAND_STRIDE = 1_000_000

export const zIndexOf = (band: number, order: number): number => band * Z_BAND_STRIDE + order
export const objectZ = (o: GardenObject): number => zIndexOf(o.band, o.order)

export interface PickHit {
  ref: SelectionRef
  z: number
  /** Footprint in m². Breaks ties in favour of the smaller, fiddlier target. */
  area: number
  /** True when the hit came from the bounding box, not the artwork itself. */
  approximate: boolean
}

export interface PickOptions {
  /** Click slop, in world metres. Derive from a screen-pixel budget / scale. */
  tolerance: number
  includeLocked: boolean
  includeHidden: boolean
  /** Surfaces are huge; excluding them keeps "click the lawn" out of the way. */
  includeSurfaces: boolean
  /** Restrict to a single band, used by band-isolation mode. */
  onlyBand?: number
}

export const DEFAULT_PICK_OPTIONS: PickOptions = {
  tolerance: 0,
  includeLocked: false,
  includeHidden: false,
  includeSurfaces: true,
}

function hitsObject(o: GardenObject, asset: AssetDef | undefined, world: Vec2, tolerance: number) {
  const bounds = objectBounds(o)
  if (!rectContains(expandRect(bounds, tolerance), world)) return null

  // Into the object's own unrotated frame.
  const r = -o.rotation * (Math.PI / 180)
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const dx = world.x - o.x
  const dy = world.y - o.y
  let lx = dx * cos - dy * sin
  let ly = dx * sin + dy * cos
  if (o.flipX) lx = -lx
  if (o.flipY) ly = -ly

  const hw = o.w / 2
  const hh = o.h / 2
  if (lx < -hw - tolerance || lx > hw + tolerance || ly < -hh - tolerance || ly > hh + tolerance) {
    return null
  }

  const loaded = asset ? getImage(asset.src) : undefined
  if (!loaded?.mask) {
    // Artwork not decoded yet, or pixels unreadable: fall back to the footprint.
    return { approximate: true }
  }

  const u = (lx + hw) / o.w
  const v = (ly + hh) / o.h
  // Tolerance is expressed in world metres; the mask is normalised per axis,
  // so use the looser of the two so thin artwork stays grabbable.
  const radius = tolerance > 0 ? Math.max(tolerance / o.w, tolerance / o.h) : 0
  return sampleMask(loaded.mask, u, v, radius) ? { approximate: false } : null
}

function hitsSurface(s: Surface, world: Vec2) {
  return pointInMultiPoly(s.geometry, world)
}

/**
 * Everything under `world`, topmost first.
 *
 * Depth here is purely the document's own stacking order — band, then manual
 * position within the band. Nothing about selection or recency feeds into it,
 * which is exactly why clicking a buried item leaves the stack untouched.
 */
export function pickStack(
  doc: GardenDoc,
  assets: ReadonlyMap<string, AssetDef>,
  world: Vec2,
  options: Partial<PickOptions> = {},
): PickHit[] {
  const opts = { ...DEFAULT_PICK_OPTIONS, ...options }
  const hits: PickHit[] = []

  for (const o of Object.values(doc.objects)) {
    if (o.hidden && !opts.includeHidden) continue
    if (o.locked && !opts.includeLocked) continue
    if (opts.onlyBand !== undefined && o.band !== opts.onlyBand) continue
    const res = hitsObject(o, assets.get(o.assetId), world, opts.tolerance)
    if (res) {
      hits.push({
        ref: { kind: 'object', id: o.id },
        z: objectZ(o),
        area: o.w * o.h,
        approximate: res.approximate,
      })
    }
  }

  if (opts.includeSurfaces && opts.onlyBand === undefined) {
    for (const s of doc.surfaces) {
      if (s.hidden && !opts.includeHidden) continue
      if (s.locked && !opts.includeLocked) continue
      if (hitsSurface(s, world)) {
        hits.push({
          ref: { kind: 'surface', id: s.id },
          z: zIndexOf(0, s.order),
          area: Number.POSITIVE_INFINITY,
          approximate: false,
        })
      }
    }
  }

  hits.sort((a, b) => (b.z !== a.z ? b.z - a.z : a.area - b.area))
  return hits
}

export function pickTop(
  doc: GardenDoc,
  assets: ReadonlyMap<string, AssetDef>,
  world: Vec2,
  options: Partial<PickOptions> = {},
): SelectionRef | null {
  return pickStack(doc, assets, world, options)[0]?.ref ?? null
}

// ---------------------------------------------------------------------------
// Click cycling
// ---------------------------------------------------------------------------

export interface PickCycleState {
  /** Where the cycle started, in world metres. */
  x: number
  y: number
  /** Identity of the candidate stack, so a changed scene resets the cycle. */
  key: string
  index: number
}

const stackKey = (hits: PickHit[]) => hits.map((h) => `${h.ref.kind}:${h.ref.id}`).join('|')

export interface ResolvedPick {
  ref: SelectionRef | null
  cycle: PickCycleState | null
  /** Position within the stack and its size, for the "2 of 5" status readout. */
  depth: number
  total: number
}

/**
 * Turn a click into a selection, advancing through overlapping candidates when
 * the same spot is clicked repeatedly (or when `goDeeper` is set, e.g. Alt).
 *
 * Repeat clicks walk *downwards* and wrap, so everything buried under a point
 * is reachable without touching the z-order, and without the hidden-state
 * problem you get from tools that promote whatever you last clicked.
 */
export function resolvePick(
  doc: GardenDoc,
  assets: ReadonlyMap<string, AssetDef>,
  world: Vec2,
  previous: PickCycleState | null,
  options: Partial<PickOptions> = {},
  goDeeper = false,
): ResolvedPick {
  const hits = pickStack(doc, assets, world, options)
  if (hits.length === 0) return { ref: null, cycle: null, depth: 0, total: 0 }

  const key = stackKey(hits)
  const tol = options.tolerance ?? 0
  const sameSpot =
    previous !== null &&
    previous.key === key &&
    Math.abs(previous.x - world.x) <= tol * 2 + 1e-6 &&
    Math.abs(previous.y - world.y) <= tol * 2 + 1e-6

  let index = 0
  if (sameSpot) index = (previous.index + 1) % hits.length
  else if (goDeeper && hits.length > 1) index = 1

  return {
    ref: hits[index].ref,
    cycle: { x: world.x, y: world.y, key, index },
    depth: index + 1,
    total: hits.length,
  }
}

/** Objects fully or partly inside a rubber-band rectangle, in draw order. */
export function pickInRect(
  doc: GardenDoc,
  rect: { x: number; y: number; w: number; h: number },
  opts: { requireFullyInside: boolean; includeLocked: boolean } = {
    requireFullyInside: false,
    includeLocked: false,
  },
): SelectionRef[] {
  const out: { ref: SelectionRef; z: number }[] = []
  for (const o of Object.values(doc.objects)) {
    if (o.hidden) continue
    if (o.locked && !opts.includeLocked) continue
    const b = objectBounds(o)
    const inside = opts.requireFullyInside
      ? b.x >= rect.x && b.y >= rect.y && b.x + b.w <= rect.x + rect.w && b.y + b.h <= rect.y + rect.h
      : b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y
    if (inside) out.push({ ref: { kind: 'object', id: o.id }, z: objectZ(o) })
  }
  out.sort((a, b) => a.z - b.z)
  return out.map((h) => h.ref)
}
