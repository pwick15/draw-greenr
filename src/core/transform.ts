import { objectBounds, rotate, unionRects } from './geometry'
import type { GardenObject, Rect, Vec2 } from './types'

/** Smallest footprint an object may be resized to, in metres. */
export const MIN_SIZE = 0.05

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const CORNER_HANDLES: HandleId[] = ['nw', 'ne', 'se', 'sw']
export const EDGE_HANDLES: HandleId[] = ['n', 'e', 's', 'w']
export const ALL_HANDLES: HandleId[] = [...CORNER_HANDLES, ...EDGE_HANDLES]

/** Unit offsets from the centre: -1, 0 or +1 on each axis. */
export function handleDirection(handle: HandleId): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } {
  const sx = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0
  const sy = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0
  return { sx: sx as -1 | 0 | 1, sy: sy as -1 | 0 | 1 }
}

/** Handle position in world space for a single (possibly rotated) object. */
export function handlePoint(o: GardenObject, handle: HandleId): Vec2 {
  const { sx, sy } = handleDirection(handle)
  const local = { x: (sx * o.w) / 2, y: (sy * o.h) / 2 }
  const r = rotate(local, o.rotation)
  return { x: o.x + r.x, y: o.y + r.y }
}

/** Handle position for an axis-aligned box (used by multi-selection). */
export function boxHandlePoint(box: Rect, handle: HandleId): Vec2 {
  const { sx, sy } = handleDirection(handle)
  return {
    x: box.x + box.w / 2 + (sx * box.w) / 2,
    y: box.y + box.h / 2 + (sy * box.h) / 2,
  }
}

export interface ResizeOptions {
  /** Preserve the aspect ratio (asset default, or Shift). */
  keepAspect: boolean
  /** Resize about the centre instead of the opposite corner (Alt). */
  fromCentre: boolean
  /** Round the resulting size to this many metres. 0 disables. */
  snap: number
}

export interface ObjectBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Resize one object by dragging `handle` to `world`.
 *
 * Runs entirely in the object's own rotated frame, so dragging the east edge
 * of a 30-degree-rotated bench widens it along the bench rather than along the
 * screen — which is what anyone dragging that handle expects.
 */
export function resizeObject(
  o: GardenObject,
  handle: HandleId,
  world: Vec2,
  options: ResizeOptions,
): ObjectBox {
  const { sx, sy } = handleDirection(handle)
  // Pointer into the object's unrotated frame, relative to its centre.
  const local = rotate({ x: world.x - o.x, y: world.y - o.y }, -o.rotation)

  const anchor = { x: (-sx * o.w) / 2, y: (-sy * o.h) / 2 }

  if (options.fromCentre) {
    let w = sx === 0 ? o.w : Math.max(MIN_SIZE, Math.abs(local.x) * 2)
    let h = sy === 0 ? o.h : Math.max(MIN_SIZE, Math.abs(local.y) * 2)
    if (options.keepAspect && sx !== 0 && sy !== 0) {
      const k = Math.max(w / o.w, h / o.h)
      w = o.w * k
      h = o.h * k
    }
    ;({ w, h } = snapSize(w, h, options.snap))
    return { x: o.x, y: o.y, w, h }
  }

  // Signed extent from the fixed anchor to the pointer.
  let rawX = sx === 0 ? 0 : local.x - anchor.x
  let rawY = sy === 0 ? 0 : local.y - anchor.y
  if (sx !== 0 && Math.abs(rawX) < MIN_SIZE) rawX = MIN_SIZE * (Math.sign(rawX) || sx)
  if (sy !== 0 && Math.abs(rawY) < MIN_SIZE) rawY = MIN_SIZE * (Math.sign(rawY) || sy)

  let w = sx === 0 ? o.w : Math.abs(rawX)
  let h = sy === 0 ? o.h : Math.abs(rawY)

  if (options.keepAspect) {
    if (sx !== 0 && sy !== 0) {
      const k = Math.max(w / o.w, h / o.h)
      w = o.w * k
      h = o.h * k
    } else if (sx !== 0) {
      h = (o.h / o.w) * w
    } else if (sy !== 0) {
      w = (o.w / o.h) * h
    }
  }
  ;({ w, h } = snapSize(w, h, options.snap))

  // Keep the anchor pinned: the centre sits half a span away from it, on the
  // side the pointer is actually on.
  const dirX = Math.sign(rawX) || sx
  const dirY = Math.sign(rawY) || sy
  const cx = sx === 0 ? 0 : anchor.x + (dirX * w) / 2
  const cy = sy === 0 ? 0 : anchor.y + (dirY * h) / 2
  // Aspect lock on an edge handle grows the other axis symmetrically.
  const localCentre = {
    x: sx === 0 ? 0 : cx,
    y: sy === 0 ? 0 : cy,
  }
  const d = rotate(localCentre, o.rotation)
  return { x: o.x + d.x, y: o.y + d.y, w, h }
}

function snapSize(w: number, h: number, snap: number): { w: number; h: number } {
  if (snap <= 0) return { w, h }
  return {
    w: Math.max(MIN_SIZE, Math.round(w / snap) * snap),
    h: Math.max(MIN_SIZE, Math.round(h / snap) * snap),
  }
}

// ---------------------------------------------------------------------------
// Group transforms
// ---------------------------------------------------------------------------

export function selectionBounds(objects: GardenObject[]): Rect | null {
  return unionRects(objects.map(objectBounds))
}

/**
 * Scale a group about the handle's opposite corner. Object rotations are left
 * alone; only centres and footprints scale, which keeps a rotated item rotated
 * by the same angle after the group is stretched.
 */
export function resizeGroup(
  objects: GardenObject[],
  startBox: Rect,
  handle: HandleId,
  world: Vec2,
  options: ResizeOptions,
): Map<string, ObjectBox> {
  const { sx, sy } = handleDirection(handle)
  const anchor = boxHandlePoint(startBox, oppositeHandle(handle))

  let kx = sx === 0 ? 1 : (world.x - anchor.x) / (boxHandlePoint(startBox, handle).x - anchor.x)
  let ky = sy === 0 ? 1 : (world.y - anchor.y) / (boxHandlePoint(startBox, handle).y - anchor.y)
  if (!Number.isFinite(kx) || kx === 0) kx = 1
  if (!Number.isFinite(ky) || ky === 0) ky = 1
  kx = Math.abs(kx)
  ky = Math.abs(ky)

  if (options.keepAspect) {
    const k = sx !== 0 && sy !== 0 ? Math.max(kx, ky) : sx !== 0 ? kx : ky
    kx = k
    ky = k
  }

  const out = new Map<string, ObjectBox>()
  for (const o of objects) {
    out.set(o.id, {
      x: anchor.x + (o.x - anchor.x) * kx,
      y: anchor.y + (o.y - anchor.y) * ky,
      w: Math.max(MIN_SIZE, o.w * kx),
      h: Math.max(MIN_SIZE, o.h * ky),
    })
  }
  return out
}

export function oppositeHandle(handle: HandleId): HandleId {
  const map: Record<HandleId, HandleId> = {
    nw: 'se',
    n: 's',
    ne: 'sw',
    e: 'w',
    se: 'nw',
    s: 'n',
    sw: 'ne',
    w: 'e',
  }
  return map[handle]
}

export interface RotatedPlacement {
  x: number
  y: number
  rotation: number
}

/** Rotate objects about a pivot by `delta` degrees. */
export function rotateAbout(
  objects: GardenObject[],
  pivot: Vec2,
  delta: number,
): Map<string, RotatedPlacement> {
  const out = new Map<string, RotatedPlacement>()
  for (const o of objects) {
    const d = rotate({ x: o.x - pivot.x, y: o.y - pivot.y }, delta)
    out.set(o.id, { x: pivot.x + d.x, y: pivot.y + d.y, rotation: o.rotation + delta })
  }
  return out
}

/** Angle in degrees from `centre` to `point`, measured clockwise from +x. */
export function angleTo(centre: Vec2, point: Vec2): number {
  return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI
}

export function snapAngle(deg: number, step: number): number {
  return step > 0 ? Math.round(deg / step) * step : deg
}

/** Cursor for a resize handle, accounting for the object's rotation. */
export function handleCursor(handle: HandleId, rotation: number): string {
  const base: Record<HandleId, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }
  const angle = (((base[handle] + rotation) % 360) + 360) % 360
  const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
  return cursors[Math.round(angle / 45) % 4]
}
