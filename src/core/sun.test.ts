import { describe, expect, it } from 'vitest'

import { ringSignedArea, convexHull } from './geometry'
import { shadowOffset, shadowRings, shadowRing } from './shadows'
import {
  dayOfYear,
  declination,
  EQUINOX_SPRING,
  SOLSTICE_SUMMER,
  SOLSTICE_WINTER,
  sunPosition,
} from './sun'
import type { GardenObject, Vec2 } from './types'
import { Band } from './types'

/** London, near enough. */
const LONDON = 51.5
const SYDNEY = -33.9

describe('declination', () => {
  it('reaches its northern extreme at the June solstice', () => {
    expect(declination(SOLSTICE_SUMMER)).toBeCloseTo(23.44, 1)
  })

  it('reaches its southern extreme at the December solstice', () => {
    expect(declination(SOLSTICE_WINTER)).toBeCloseTo(-23.44, 1)
  })

  it('is near zero at the equinox', () => {
    expect(Math.abs(declination(EQUINOX_SPRING))).toBeLessThan(1.5)
  })
})

describe('sunPosition', () => {
  it('puts the sun due south at noon in the northern hemisphere', () => {
    expect(sunPosition(SOLSTICE_SUMMER, 12, LONDON).azimuth).toBeCloseTo(180, 4)
  })

  it('puts the sun due north at noon in the southern hemisphere', () => {
    expect(sunPosition(SOLSTICE_SUMMER, 12, SYDNEY).azimuth).toBeCloseTo(0, 4)
  })

  it('rises in the east and sets in the west', () => {
    const morning = sunPosition(EQUINOX_SPRING, 8, LONDON)
    const evening = sunPosition(EQUINOX_SPRING, 16, LONDON)
    // Bearings under 180 are east of south; over 180 are west of it.
    expect(morning.azimuth).toBeLessThan(180)
    expect(evening.azimuth).toBeGreaterThan(180)
  })

  it('is highest at solar noon', () => {
    const noon = sunPosition(EQUINOX_SPRING, 12, LONDON).elevation
    for (const hour of [7, 9, 11, 13, 15, 17]) {
      expect(sunPosition(EQUINOX_SPRING, hour, LONDON).elevation).toBeLessThan(noon)
    }
  })

  it('gets the equinox noon elevation right', () => {
    // At an equinox the noon sun sits exactly (90 - latitude) above the horizon.
    expect(sunPosition(EQUINOX_SPRING, 12, LONDON).elevation).toBeCloseTo(90 - LONDON, 0)
  })

  it('climbs higher in summer than in winter', () => {
    const summer = sunPosition(SOLSTICE_SUMMER, 12, LONDON).elevation
    const winter = sunPosition(SOLSTICE_WINTER, 12, LONDON).elevation
    expect(summer).toBeGreaterThan(winter)
    expect(summer - winter).toBeCloseTo(2 * 23.44, 0)
  })

  it('has the sun below the horizon at midnight', () => {
    expect(sunPosition(SOLSTICE_SUMMER, 0, LONDON).elevation).toBeLessThan(0)
  })

  it('keeps the midsummer sun up all day inside the Arctic circle', () => {
    expect(sunPosition(SOLSTICE_SUMMER, 0, 78).elevation).toBeGreaterThan(0)
  })

  it('always reports a bearing in range', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { azimuth } = sunPosition(SOLSTICE_SUMMER, hour, LONDON)
      expect(azimuth).toBeGreaterThanOrEqual(0)
      expect(azimuth).toBeLessThan(360)
    }
  })
})

describe('dayOfYear', () => {
  it('counts 1 January as day one', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
  })

  it('counts 31 December as the last day', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
  })
})

// ---------------------------------------------------------------------------

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o1',
  assetId: 'oak',
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Canopy,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

/** Sun due south, 45 degrees up: shadows equal the height and point north. */
const SOUTH_45 = { sun: { elevation: 45, azimuth: 180 }, northUp: 0 }

describe('shadowOffset', () => {
  it('is as long as the object is tall when the sun is at 45 degrees', () => {
    const offset = shadowOffset(5, SOUTH_45)!
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(5, 9)
  })

  it('points north — up the plan — when the sun is in the south', () => {
    const offset = shadowOffset(5, SOUTH_45)!
    expect(offset.x).toBeCloseTo(0, 9)
    expect(offset.y).toBeCloseTo(-5, 9)
  })

  it('points west when the sun is in the east', () => {
    const offset = shadowOffset(5, { sun: { elevation: 45, azimuth: 90 }, northUp: 0 })!
    expect(offset.x).toBeCloseTo(-5, 9)
    expect(offset.y).toBeCloseTo(0, 9)
  })

  it('lengthens as the sun drops', () => {
    const high = shadowOffset(5, { sun: { elevation: 60, azimuth: 180 }, northUp: 0 })!
    const low = shadowOffset(5, { sun: { elevation: 20, azimuth: 180 }, northUp: 0 })!
    expect(Math.hypot(low.x, low.y)).toBeGreaterThan(Math.hypot(high.x, high.y))
  })

  it('scales with height', () => {
    const short = shadowOffset(2, SOUTH_45)!
    const tall = shadowOffset(8, SOUTH_45)!
    expect(Math.hypot(tall.x, tall.y) / Math.hypot(short.x, short.y)).toBeCloseTo(4, 9)
  })

  it('casts nothing once the sun is down', () => {
    expect(shadowOffset(5, { sun: { elevation: -10, azimuth: 180 }, northUp: 0 })).toBeNull()
  })

  it('casts nothing from something with no height', () => {
    expect(shadowOffset(0, SOUTH_45)).toBeNull()
  })

  it('refuses to run away when the sun grazes the horizon', () => {
    // At a fraction of a degree the true shadow is hundreds of metres long.
    expect(shadowOffset(5, { sun: { elevation: 0.2, azimuth: 180 }, northUp: 0 })).toBeNull()
  })

  it('honours a length cap', () => {
    const offset = shadowOffset(30, { sun: { elevation: 5, azimuth: 180 }, northUp: 0, maxLength: 20 })!
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(20, 9)
  })

  it('turns with the plan when north is not up', () => {
    // Rotating the site 90 degrees must rotate the shadow with it.
    const offset = shadowOffset(5, { sun: { elevation: 45, azimuth: 180 }, northUp: 90 })!
    expect(offset.x).toBeCloseTo(-5, 9)
    expect(offset.y).toBeCloseTo(0, 9)
  })
})

describe('shadowRing', () => {
  it('encloses both the object and where its shadow lands', () => {
    const ring = shadowRing(object({ w: 2, h: 2 }), 5, SOUTH_45)!
    const ys = ring.map(([, y]) => y)
    // The object spans y -1..1 and the shadow reaches 5 m further north.
    expect(Math.min(...ys)).toBeCloseTo(-6, 6)
    expect(Math.max(...ys)).toBeCloseTo(1, 6)
  })

  it('has area — a shadow is a region, not a line', () => {
    const ring = shadowRing(object(), 5, SOUTH_45)!
    expect(Math.abs(ringSignedArea(ring))).toBeGreaterThan(0)
  })

  it('is at least as large as the object that casts it', () => {
    const ring = shadowRing(object({ w: 2, h: 2 }), 5, SOUTH_45)!
    expect(Math.abs(ringSignedArea(ring))).toBeGreaterThanOrEqual(4)
  })

  it('follows a rotated object rather than its bounding box', () => {
    const ring = shadowRing(object({ w: 4, h: 1, rotation: 45 }), 3, SOUTH_45)!
    const xs = ring.map(([x]) => x)
    // A 4x1 bar turned 45 degrees reaches about 1.77 m each side, not 2.
    expect(Math.max(...xs)).toBeLessThan(2)
    expect(Math.max(...xs)).toBeGreaterThan(1.5)
  })

  it('is nothing when the sun is down', () => {
    expect(shadowRing(object(), 5, { sun: { elevation: -5, azimuth: 180 }, northUp: 0 })).toBeNull()
  })
})

describe('shadowRings', () => {
  const tall = (o: GardenObject) => (o.assetId === 'oak' ? 12 : 0)

  it('skips objects with no height', () => {
    const result = shadowRings(
      [object({ id: 'a', assetId: 'oak' }), object({ id: 'b', assetId: 'paving' })],
      tall,
      SOUTH_45,
    )
    expect(result.map((r) => r.objectId)).toEqual(['a'])
  })

  it('skips hidden objects', () => {
    const result = shadowRings([object({ id: 'a', hidden: true })], tall, SOUTH_45)
    expect(result).toEqual([])
  })

  it('reports the shadow length alongside the shape', () => {
    const [shadow] = shadowRings([object({ id: 'a' })], tall, SOUTH_45)
    expect(shadow.length).toBeCloseTo(12, 6)
  })
})

describe('convexHull', () => {
  it('keeps the corners of a square and drops the middle', () => {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 1 },
    ]
    expect(convexHull(points)).toHaveLength(4)
  })

  it('drops a point sitting on an edge', () => {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 0 },
    ]
    expect(convexHull(points)).toHaveLength(4)
  })

  it('encloses the true area', () => {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]
    expect(Math.abs(ringSignedArea(convexHull(square)))).toBeCloseTo(9, 9)
  })

  it('gives the same hull whatever order the points arrive in', () => {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 1 },
      { x: 2, y: 5 },
      { x: 1, y: 2 },
    ]
    const a = convexHull(points)
    const b = convexHull([...points].reverse())
    expect(Math.abs(ringSignedArea(a))).toBeCloseTo(Math.abs(ringSignedArea(b)), 9)
    expect(a.length).toBe(b.length)
  })

  it('collapses duplicates instead of emitting a degenerate ring', () => {
    const doubled: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]
    expect(convexHull(doubled)).toHaveLength(3)
  })

  it('passes through fewer than three points untouched', () => {
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([[1, 1]])
    expect(convexHull([])).toEqual([])
  })
})
