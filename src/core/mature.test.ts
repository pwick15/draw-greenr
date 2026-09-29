import { describe, expect, it } from 'vitest'

import { MATURE_SIZES, matureSize, requiredSpacing, spreadRings } from './mature'
import type { GardenObject } from './types'
import { Band } from './types'

const plant = (id: string, assetId: string, x: number, y = 0): GardenObject => ({
  id,
  assetId,
  x,
  y,
  w: 1,
  h: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Planting,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
})

describe('the table itself', () => {
  it('gives every entry a positive spread and a timescale', () => {
    const bad = Object.entries(MATURE_SIZES).filter(
      ([, size]) => !(size.spread > 0) || !(size.years > 0),
    )
    expect(bad).toEqual([])
  })

  it('keeps forest trees wider than shrubs', () => {
    expect(MATURE_SIZES.oak.spread).toBeGreaterThan(MATURE_SIZES.lavender.spread)
    expect(MATURE_SIZES.lime.spread).toBeGreaterThan(MATURE_SIZES['boxwood-ball'].spread)
  })

  it('has no entry for things a circle would misdescribe', () => {
    // Hedges are runs and pots constrain their plant; a ring would be a lie.
    for (const id of ['hedge-2m', 'hedge-tall', 'potted-plant', 'climber-trellis', 'deck']) {
      expect(matureSize(id), id).toBeNull()
    }
  })
})

describe('spreadRings', () => {
  it('uses half the spread as the radius', () => {
    const [ring] = spreadRings([plant('a', 'oak', 0)])
    expect(ring.radius).toBe(MATURE_SIZES.oak.spread / 2)
  })

  it('ignores an asset with no known mature size', () => {
    expect(spreadRings([plant('a', 'shed', 0)])).toEqual([])
  })

  it('ignores hidden objects', () => {
    expect(spreadRings([{ ...plant('a', 'oak', 0), hidden: true }])).toEqual([])
  })

  it('ignores how large the object was drawn', () => {
    // A sapling drawn one metre across still becomes a twenty-metre oak.
    const sapling = { ...plant('a', 'oak', 0), w: 0.5, h: 0.5 }
    expect(spreadRings([sapling])[0].radius).toBe(10)
  })

  it('leaves well-spaced plants uncrowded', () => {
    const rings = spreadRings([plant('a', 'lavender', 0), plant('b', 'lavender', 5)])
    expect(rings.every((r) => !r.crowded)).toBe(true)
  })

  it('flags both plants when their mature crowns would meet', () => {
    // Lavender spreads 0.8 m, so anything under 0.8 m apart collides.
    const rings = spreadRings([plant('a', 'lavender', 0), plant('b', 'lavender', 0.4)])
    expect(rings.every((r) => r.crowded)).toBe(true)
  })

  it('treats exactly touching as clear, not crowded', () => {
    const rings = spreadRings([plant('a', 'lavender', 0), plant('b', 'lavender', 0.8)])
    expect(rings.every((r) => !r.crowded)).toBe(true)
  })

  it('measures in two dimensions, not just along x', () => {
    const rings = spreadRings([plant('a', 'lavender', 0, 0), plant('b', 'lavender', 0, 0.4)])
    expect(rings.every((r) => r.crowded)).toBe(true)
  })

  it('crowds a small plant sitting under a large canopy', () => {
    const rings = spreadRings([plant('oak', 'oak', 0), plant('lav', 'lavender', 6)])
    // The oak reaches 10 m, so the lavender is well inside it.
    expect(rings.every((r) => r.crowded)).toBe(true)
  })

  it('leaves the innocent third plant alone', () => {
    const rings = spreadRings([
      plant('a', 'lavender', 0),
      plant('b', 'lavender', 0.4),
      plant('c', 'lavender', 40),
    ])
    expect(rings.find((r) => r.objectId === 'c')!.crowded).toBe(false)
  })
})

describe('requiredSpacing', () => {
  it('is the mean of the two spreads', () => {
    expect(requiredSpacing('lavender', 'lavender')).toBeCloseTo(0.8, 9)
    expect(requiredSpacing('oak', 'lavender')).toBeCloseTo((20 + 0.8) / 2, 9)
  })

  it('is unknown when either plant is', () => {
    expect(requiredSpacing('oak', 'shed')).toBeNull()
    expect(requiredSpacing('shed', 'shed')).toBeNull()
  })
})
