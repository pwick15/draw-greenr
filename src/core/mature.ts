import type { GardenObject, Vec2 } from './types'

/**
 * How wide a plant ends up.
 *
 * A plan drawn at planting size is a plan that looks right for two years and
 * then becomes a thicket. These are typical mature spreads in temperate
 * conditions — crown diameter for a tree, clump width for a shrub — which is
 * what spacing should actually be set from.
 *
 * Only shapes where a circle is the honest answer appear here. A hedge, a
 * trellis or a raised bed is a run or a container, and drawing a ring round it
 * would say something untrue about how it grows.
 */
export interface MatureSize {
  /** Typical mature spread in metres. */
  spread: number
  /** Roughly how many years to get there. */
  years: number
}

export const MATURE_SIZES: Record<string, MatureSize> = {
  // Trees.
  oak: { spread: 20, years: 60 },
  maple: { spread: 10, years: 30 },
  birch: { spread: 8, years: 25 },
  lime: { spread: 12, years: 40 },
  cherry: { spread: 8, years: 20 },
  apple: { spread: 4, years: 15 },
  magnolia: { spread: 6, years: 25 },
  'japanese-maple': { spread: 4, years: 25 },
  olive: { spread: 5, years: 30 },
  'autumn-tree': { spread: 8, years: 25 },
  pine: { spread: 8, years: 40 },
  spruce: { spread: 5, years: 30 },
  cypress: { spread: 3, years: 20 },
  palm: { spread: 2.5, years: 20 },
  'tree-fern': { spread: 3, years: 20 },

  // Shrubs and clump-forming planting.
  'boxwood-ball': { spread: 0.8, years: 10 },
  'boxwood-large': { spread: 1.5, years: 15 },
  lavender: { spread: 0.8, years: 4 },
  hydrangea: { spread: 1.8, years: 8 },
  'rose-bush': { spread: 1.2, years: 5 },
  rhododendron: { spread: 3, years: 15 },
  viburnum: { spread: 3, years: 10 },
  'ornamental-grass': { spread: 1, years: 3 },
  'pampas-grass': { spread: 2, years: 5 },
  fern: { spread: 1, years: 5 },
  hosta: { spread: 0.9, years: 5 },
}

export const matureSize = (assetId: string): MatureSize | null => MATURE_SIZES[assetId] ?? null

export interface SpreadRing {
  objectId: string
  centre: Vec2
  radius: number
  spread: number
  years: number
  /** Its mature crown would reach into a neighbour's. */
  crowded: boolean
}

/**
 * Mature footprints for everything in a plan, flagging the ones that collide.
 *
 * Crowding is the whole reason to draw these. Two shrubs 40 cm apart look
 * deliberate on a plan and are a solid mass in three years, and that is very
 * hard to see from planting-size artwork alone.
 *
 * Radii are absolute, not scaled by how large the object was drawn: a sapling
 * oak drawn a metre across still becomes a twenty-metre oak, which is exactly
 * the thing worth knowing before it goes in the ground.
 */
export function spreadRings(objects: readonly GardenObject[]): SpreadRing[] {
  const rings: SpreadRing[] = []

  for (const object of objects) {
    if (object.hidden) continue
    const size = matureSize(object.assetId)
    if (!size) continue
    rings.push({
      objectId: object.id,
      centre: { x: object.x, y: object.y },
      radius: size.spread / 2,
      spread: size.spread,
      years: size.years,
      crowded: false,
    })
  }

  // Pairwise, which is fine: a plan has hundreds of plants, not millions, and
  // this only runs when the overlay is switched on.
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const a = rings[i]
      const b = rings[j]
      const gap = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y)
      if (gap < a.radius + b.radius) {
        a.crowded = true
        b.crowded = true
      }
    }
  }

  return rings
}

/** Centre-to-centre distance two plants need to clear each other at maturity. */
export function requiredSpacing(assetIdA: string, assetIdB: string): number | null {
  const a = matureSize(assetIdA)
  const b = matureSize(assetIdB)
  if (!a || !b) return null
  return (a.spread + b.spread) / 2
}
