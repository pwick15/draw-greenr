import { convexHull, objectCorners } from './geometry'
import type { SunPosition } from './sun'
import type { GardenObject, Ring, Vec2 } from './types'

/**
 * Ground shadows, cast from the heights the plan already knows about.
 *
 * Height comes in as a lookup rather than an import, so this stays free of the
 * 3D module and testable with whatever heights a test wants to invent.
 */

const DEG = Math.PI / 180

/**
 * Below this the sun is grazing the horizon and shadow length runs away
 * towards infinity — 1° already gives a shadow 57 times the height. Anything
 * lower is drawn as no shadow at all, which is honest enough at dusk.
 */
const MIN_ELEVATION = 1

export interface ShadowContext {
  sun: SunPosition
  /**
   * Compass bearing that the top of the plan points to. 0 means north is up,
   * which is how plans are normally drawn; rotate it to match a site that was
   * surveyed on a different orientation.
   */
  northUp: number
  /** Cap on shadow length in metres. Omit for the true, uncapped length. */
  maxLength?: number
}

/**
 * How far and which way a shadow falls, in plan metres.
 *
 * Null when the sun is down — no shadow is the correct answer, rather than one
 * stretching off the page.
 */
export function shadowOffset(height: number, ctx: ShadowContext): Vec2 | null {
  if (!(height > 0)) return null
  if (ctx.sun.elevation < MIN_ELEVATION) return null

  let length = height / Math.tan(ctx.sun.elevation * DEG)
  if (ctx.maxLength !== undefined) length = Math.min(length, ctx.maxLength)

  // A shadow points directly away from the sun, and the plan may not have
  // north at the top.
  const bearing = ctx.sun.azimuth + 180 - ctx.northUp
  const radians = bearing * DEG
  // Plan y runs down the screen, so "towards the top" is negative y.
  return { x: length * Math.sin(radians), y: -length * Math.cos(radians) }
}

/**
 * The ground footprint of one object's shadow.
 *
 * A convex body swept along a straight line covers exactly the convex hull of
 * its start and end positions, so the hull of the footprint and its translated
 * copy is the shadow — no sampling, no approximation.
 */
export function shadowRing(object: GardenObject, height: number, ctx: ShadowContext): Ring | null {
  const offset = shadowOffset(height, ctx)
  if (!offset) return null
  const corners = objectCorners(object)
  return convexHull([...corners, ...corners.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }))])
}

export interface ObjectShadow {
  objectId: string
  ring: Ring
  /** Shadow length in metres, for a readout. */
  length: number
}

export function shadowRings(
  objects: readonly GardenObject[],
  heightOf: (object: GardenObject) => number,
  ctx: ShadowContext,
): ObjectShadow[] {
  const out: ObjectShadow[] = []
  for (const object of objects) {
    if (object.hidden) continue
    const height = heightOf(object)
    const offset = shadowOffset(height, ctx)
    if (!offset) continue
    const corners = objectCorners(object)
    out.push({
      objectId: object.id,
      ring: convexHull([
        ...corners,
        ...corners.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })),
      ]),
      length: Math.hypot(offset.x, offset.y),
    })
  }
  return out
}
