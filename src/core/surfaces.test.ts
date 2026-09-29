import { describe, expect, it } from 'vitest'

import { multiPolyArea, pointInMultiPoly } from './geometry'
import {
  differenceMulti,
  eraseFromAll,
  insertVertex,
  moveVertex,
  paintSurface,
  pointsToRing,
  removePolygonAt,
  removeVertex,
  unionMulti,
} from './surfaces'
import type { MaterialDef, MultiPoly, Ring, Surface, Vec2 } from './types'

const material = (id: string, occludes = true): MaterialDef => ({
  id,
  name: id,
  source: 'builtin',
  fill: '#000',
  textureScale: 1,
  occludes,
})

const MATERIALS = new Map<string, MaterialDef>([
  ['lawn', material('lawn')],
  ['paving', material('paving')],
  ['water', material('water', false)],
])

const box = (x: number, y: number, w: number, h: number): MultiPoly => [
  [
    pointsToRing([
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ] as Vec2[]),
  ],
]

const surfaceFor = (result: { surfaces: Surface[] }, materialId: string) =>
  result.surfaces.find((s) => s.materialId === materialId)

describe('boolean helpers', () => {
  it('unions overlapping boxes without double-counting the overlap', () => {
    // 100 + 75 sharing a 5x5 corner.
    const merged = unionMulti(box(0, 0, 10, 10), box(5, 0, 15, 5))
    expect(multiPolyArea(merged)).toBeCloseTo(150, 3)
    expect(merged).toHaveLength(1)
  })

  it('opens the closed rings polyclip returns, keeping every corner', () => {
    // polyclip closes rings (`[a,b,c,d,a]`); a naive collinearity pass reads
    // the seam as degenerate and deletes a real corner, halving the area.
    const merged = unionMulti(box(0, 0, 10, 10), box(0, 0, 10, 10))
    expect(merged[0][0]).toHaveLength(4)
    expect(multiPolyArea(merged)).toBeCloseTo(100, 3)
  })

  it('punches a hole when the subtrahend is fully enclosed', () => {
    const result = differenceMulti(box(0, 0, 10, 10), box(3, 3, 4, 4))
    expect(multiPolyArea(result)).toBeCloseTo(84, 3)
    expect(result[0].length).toBe(2) // outer ring plus hole
    expect(pointInMultiPoly(result, { x: 5, y: 5 })).toBe(false)
    expect(pointInMultiPoly(result, { x: 1, y: 1 })).toBe(true)
  })

  it('treats an empty operand as a no-op', () => {
    expect(multiPolyArea(unionMulti([], box(0, 0, 2, 2)))).toBeCloseTo(4)
    expect(multiPolyArea(differenceMulti(box(0, 0, 2, 2), []))).toBeCloseTo(4)
  })
})

describe('paintSurface', () => {
  it('creates a surface the first time a material is painted', () => {
    const result = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10))
    expect(result.surfaces).toHaveLength(1)
    expect(multiPolyArea(result.surfaces[0].geometry)).toBeCloseTo(100)
    expect(result.addedArea).toBeCloseTo(100)
  })

  it('unions further paint of the same material', () => {
    let state = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const result = paintSurface(state, MATERIALS, 'lawn', box(5, 0, 10, 10))
    state = result.surfaces
    expect(state).toHaveLength(1)
    expect(multiPolyArea(state[0].geometry)).toBeCloseTo(150, 3)
    expect(result.addedArea).toBeCloseTo(50, 3)
  })

  it('carves the new material out of every other one', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const both = paintSurface(lawn, MATERIALS, 'paving', box(0, 0, 4, 10)).surfaces

    // Surfaces partition the plot: 40 + 60 = the original 100, no overlap.
    expect(multiPolyArea(surfaceFor({ surfaces: both }, 'lawn')!.geometry)).toBeCloseTo(60, 3)
    expect(multiPolyArea(surfaceFor({ surfaces: both }, 'paving')!.geometry)).toBeCloseTo(40, 3)

    const total = both.reduce((sum, s) => sum + multiPolyArea(s.geometry), 0)
    expect(total).toBeCloseTo(100, 3)
  })

  it('leaves other materials alone for a non-occluding material', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const both = paintSurface(lawn, MATERIALS, 'water', box(0, 0, 4, 10)).surfaces
    expect(multiPolyArea(surfaceFor({ surfaces: both }, 'lawn')!.geometry)).toBeCloseTo(100, 3)
    expect(multiPolyArea(surfaceFor({ surfaces: both }, 'water')!.geometry)).toBeCloseTo(40, 3)
  })

  it('drops a surface entirely once it is fully covered', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const covered = paintSurface(lawn, MATERIALS, 'paving', box(-1, -1, 12, 12)).surfaces
    expect(covered.map((s) => s.materialId)).toEqual(['paving'])
  })

  it('subtract mode cuts the target without disturbing others', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const withPaving = paintSurface(lawn, MATERIALS, 'paving', box(20, 0, 5, 5)).surfaces
    const cut = paintSurface(withPaving, MATERIALS, 'lawn', box(0, 0, 5, 10), 'subtract').surfaces
    expect(multiPolyArea(surfaceFor({ surfaces: cut }, 'lawn')!.geometry)).toBeCloseTo(50, 3)
    expect(multiPolyArea(surfaceFor({ surfaces: cut }, 'paving')!.geometry)).toBeCloseTo(25, 3)
  })

  it('replace mode discards the material everywhere else', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    const replaced = paintSurface(lawn, MATERIALS, 'lawn', box(50, 50, 2, 2), 'replace').surfaces
    expect(multiPolyArea(replaced[0].geometry)).toBeCloseTo(4, 3)
  })

  it('respects a locked surface when carving', () => {
    const lawn = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    lawn[0].locked = true
    const both = paintSurface(lawn, MATERIALS, 'paving', box(0, 0, 4, 10)).surfaces
    expect(multiPolyArea(surfaceFor({ surfaces: both }, 'lawn')!.geometry)).toBeCloseTo(100, 3)
  })
})

describe('eraseFromAll', () => {
  it('cuts the same hole out of every material at once', () => {
    let state = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    state = paintSurface(state, MATERIALS, 'water', box(0, 0, 10, 10)).surfaces
    const erased = eraseFromAll(state, box(0, 0, 5, 10))
    for (const surface of erased) {
      expect(multiPolyArea(surface.geometry)).toBeCloseTo(50, 3)
    }
  })

  it('removes a surface that is erased completely', () => {
    const state = paintSurface([], MATERIALS, 'lawn', box(0, 0, 10, 10)).surfaces
    expect(eraseFromAll(state, box(-1, -1, 12, 12))).toHaveLength(0)
  })
})

describe('vertex editing', () => {
  const geometry = box(0, 0, 10, 10)
  const ref = { polyIndex: 0, ringIndex: 0, vertexIndex: 1 }

  it('moves a single vertex without touching the others', () => {
    const moved = moveVertex(geometry, ref, { x: 20, y: 0 })
    expect(moved[0][0][1]).toEqual([20, 0])
    expect(moved[0][0][0]).toEqual([0, 0])
    expect(multiPolyArea(moved)).toBeCloseTo(150)
  })

  it('inserts after the referenced vertex', () => {
    const inserted = insertVertex(geometry, ref, { x: 10, y: 5 })
    expect(inserted[0][0]).toHaveLength(5)
    expect(inserted[0][0][2]).toEqual([10, 5])
  })

  it('removes a vertex when the ring can spare it', () => {
    const five = insertVertex(geometry, ref, { x: 10, y: 5 })
    expect(removeVertex(five, ref)[0][0]).toHaveLength(4)
  })

  it('refuses to reduce a triangle to a line', () => {
    const triangle: MultiPoly = [
      [
        pointsToRing([
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ]),
      ],
    ]
    expect(removeVertex(triangle, ref)).toBe(triangle)
  })
})

describe('removePolygonAt', () => {
  const square = (ox: number): Ring =>
    pointsToRing([
      { x: ox, y: 0 },
      { x: ox + 4, y: 0 },
      { x: ox + 4, y: 4 },
      { x: ox, y: 4 },
    ])
  // Three separate patches of one material, as the partition model stores them.
  const patches: MultiPoly = [[square(0)], [square(10)], [square(20)]]

  it('removes only the patch under the point', () => {
    const left = removePolygonAt(patches, { x: 2, y: 2 })!
    expect(left).toHaveLength(2)
    expect(multiPolyArea(left)).toBeCloseTo(32, 6)
  })

  it('leaves the other patches exactly where they were', () => {
    const left = removePolygonAt(patches, { x: 12, y: 2 })!
    expect(left[0]).toBe(patches[0])
    expect(left[1]).toBe(patches[2])
  })

  it('reports a miss rather than silently deleting nothing', () => {
    expect(removePolygonAt(patches, { x: 100, y: 100 })).toBeNull()
  })

  it('empties the geometry when the last patch goes', () => {
    expect(removePolygonAt([[square(0)]], { x: 2, y: 2 })).toEqual([])
  })

  it('treats a hole as outside the patch', () => {
    const holed: MultiPoly = [
      [
        pointsToRing([
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ]),
        pointsToRing([
          { x: 3, y: 3 },
          { x: 7, y: 3 },
          { x: 7, y: 7 },
          { x: 3, y: 7 },
        ]),
      ],
    ]
    expect(removePolygonAt(holed, { x: 5, y: 5 })).toBeNull()
    expect(removePolygonAt(holed, { x: 1, y: 1 })).toEqual([])
  })
})
