import { objectBounds } from './geometry'
import { selectionBounds } from './transform'
import type { GardenObject, Rect, Vec2 } from './types'

/**
 * Alignment and distribution.
 *
 * Everything works on each object's world-space *bounding box*, so a rotated
 * bench aligns by the edge you can actually see rather than by its untransformed
 * footprint. Each function returns new centres keyed by id — nothing mutates,
 * which keeps these testable and lets the caller wrap them in one undo step.
 */

export type AlignMode = 'left' | 'centreX' | 'right' | 'top' | 'middleY' | 'bottom'
export type Axis = 'x' | 'y'

export const ALIGN_MODES: { mode: AlignMode; axis: Axis; label: string }[] = [
  { mode: 'left', axis: 'x', label: 'Align left edges' },
  { mode: 'centreX', axis: 'x', label: 'Align horizontal centres' },
  { mode: 'right', axis: 'x', label: 'Align right edges' },
  { mode: 'top', axis: 'y', label: 'Align top edges' },
  { mode: 'middleY', axis: 'y', label: 'Align vertical centres' },
  { mode: 'bottom', axis: 'y', label: 'Align bottom edges' },
]

type Placed = { object: GardenObject; bounds: Rect }

const measure = (objects: GardenObject[]): Placed[] =>
  objects.map((object) => ({ object, bounds: objectBounds(object) }))

/** Move every object so the chosen edge or centreline matches the selection's. */
export function alignObjects(objects: GardenObject[], mode: AlignMode): Map<string, Vec2> {
  const out = new Map<string, Vec2>()
  if (objects.length < 2) return out
  const outer = selectionBounds(objects)
  if (!outer) return out

  for (const { object, bounds } of measure(objects)) {
    let dx = 0
    let dy = 0
    switch (mode) {
      case 'left':
        dx = outer.x - bounds.x
        break
      case 'centreX':
        dx = outer.x + outer.w / 2 - (bounds.x + bounds.w / 2)
        break
      case 'right':
        dx = outer.x + outer.w - (bounds.x + bounds.w)
        break
      case 'top':
        dy = outer.y - bounds.y
        break
      case 'middleY':
        dy = outer.y + outer.h / 2 - (bounds.y + bounds.h / 2)
        break
      case 'bottom':
        dy = outer.y + outer.h - (bounds.y + bounds.h)
        break
    }
    if (dx !== 0 || dy !== 0) out.set(object.id, { x: object.x + dx, y: object.y + dy })
  }
  return out
}

export type DistributeMode = 'gaps' | 'centres'

/**
 * Spread objects out between the two outermost ones, which stay put.
 *
 * `gaps` equalises the empty space between edges — what you want for a row of
 * shrubs of differing sizes. `centres` equalises centre-to-centre spacing,
 * which is what you want for fence posts or anything on a module.
 */
export function distributeObjects(
  objects: GardenObject[],
  axis: Axis,
  mode: DistributeMode = 'gaps',
): Map<string, Vec2> {
  const out = new Map<string, Vec2>()
  // Two objects are already evenly distributed by definition.
  if (objects.length < 3) return out

  const size = axis === 'x' ? ('w' as const) : ('h' as const)
  const sorted = measure(objects).sort(
    (a, b) => a.bounds[axis] + a.bounds[size] / 2 - (b.bounds[axis] + b.bounds[size] / 2),
  )

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (mode === 'centres') {
    const from = first.bounds[axis] + first.bounds[size] / 2
    const to = last.bounds[axis] + last.bounds[size] / 2
    const step = (to - from) / (sorted.length - 1)
    sorted.forEach((placed, i) => {
      if (i === 0 || i === sorted.length - 1) return
      const target = from + step * i
      const current = placed.bounds[axis] + placed.bounds[size] / 2
      out.set(placed.object.id, offset(placed.object, axis, target - current))
    })
    return out
  }

  const span = last.bounds[axis] + last.bounds[size] - first.bounds[axis]
  const occupied = sorted.reduce((sum, p) => sum + p.bounds[size], 0)
  const gap = (span - occupied) / (sorted.length - 1)

  let cursor = first.bounds[axis] + first.bounds[size] + gap
  sorted.forEach((placed, i) => {
    if (i === 0) return
    if (i === sorted.length - 1) return
    out.set(placed.object.id, offset(placed.object, axis, cursor - placed.bounds[axis]))
    cursor += placed.bounds[size] + gap
  })
  return out
}

/**
 * Lay objects out along an axis with an exact gap between them, anchored on
 * whichever is currently first. A landscaper plants at "600 mm apart", not at
 * "however far apart these happen to have ended up".
 */
export function spaceObjects(objects: GardenObject[], axis: Axis, gap: number): Map<string, Vec2> {
  const out = new Map<string, Vec2>()
  if (objects.length < 2) return out

  const size = axis === 'x' ? ('w' as const) : ('h' as const)
  const sorted = measure(objects).sort((a, b) => a.bounds[axis] - b.bounds[axis])

  let cursor = sorted[0].bounds[axis] + sorted[0].bounds[size] + gap
  for (let i = 1; i < sorted.length; i++) {
    const placed = sorted[i]
    const delta = cursor - placed.bounds[axis]
    if (delta !== 0) out.set(placed.object.id, offset(placed.object, axis, delta))
    cursor += placed.bounds[size] + gap
  }
  return out
}

/** Current edge-to-edge gaps along an axis, in document order along it. */
export function currentGaps(objects: GardenObject[], axis: Axis): number[] {
  if (objects.length < 2) return []
  const size = axis === 'x' ? ('w' as const) : ('h' as const)
  const sorted = measure(objects).sort((a, b) => a.bounds[axis] - b.bounds[axis])
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    gaps.push(sorted[i].bounds[axis] - (previous.bounds[axis] + previous.bounds[size]))
  }
  return gaps
}

const offset = (object: GardenObject, axis: Axis, delta: number): Vec2 =>
  axis === 'x' ? { x: object.x + delta, y: object.y } : { x: object.x, y: object.y + delta }
