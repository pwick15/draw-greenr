import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { BUILTIN_ASSETS, BUILTIN_MATERIALS } from '@/assets/builtin'
import { pointsToRing } from '@/core/surfaces'
import type { AssetDef, GardenDoc, GardenObject, MaterialDef, Surface } from '@/core/types'
import { Band, DEFAULT_SETTINGS } from '@/core/types'

import { BUILDERS } from './builders'
import { buildScene } from './buildScene'
import { PROFILES, profileFor } from './profiles'

const ASSETS = new Map<string, AssetDef>(BUILTIN_ASSETS.map((a) => [a.id, a]))
const MATERIALS = new Map<string, MaterialDef>(BUILTIN_MATERIALS.map((m) => [m.id, m]))

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o1',
  assetId: 'oak',
  x: 0,
  y: 0,
  w: 4,
  h: 4,
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

const surface = (materialId = 'lawn', withHole = false): Surface => ({
  id: 's1',
  materialId,
  geometry: [
    [
      pointsToRing([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
      ...(withHole
        ? [
            pointsToRing([
              { x: 3, y: 3 },
              { x: 6, y: 3 },
              { x: 6, y: 6 },
              { x: 3, y: 6 },
            ]),
          ]
        : []),
    ],
  ],
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
})

const doc = (objects: GardenObject[] = [], surfaces: Surface[] = []): GardenDoc => ({
  id: 'd',
  name: 'test',
  createdAt: 0,
  updatedAt: 0,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  surfaces,
  settings: { ...DEFAULT_SETTINGS },
})

/** Meshes anywhere under a node. */
const meshesIn = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) out.push(child)
  })
  return out
}

describe('profile coverage', () => {
  it('gives every built-in asset an explicit profile', () => {
    // A missing entry silently falls back to a category guess, which is how a
    // tree quietly renders as a generic mound. Catch it here instead.
    const missing = BUILTIN_ASSETS.filter((a) => !PROFILES[a.id]).map((a) => a.id)
    expect(missing).toEqual([])
  })

  it('points every profile at a builder that exists', () => {
    const broken = Object.entries(PROFILES)
      .filter(([, p]) => p.model !== 'decal' && !BUILDERS[p.model])
      .map(([id, p]) => `${id} -> ${p.model}`)
    expect(broken).toEqual([])
  })

  it('gives everything a positive height', () => {
    const bad = Object.entries(PROFILES).filter(([, p]) => !(p.height > 0)).map(([id]) => id)
    expect(bad).toEqual([])
  })

  it('keeps trees taller than shrubs, which is the whole point of heights', () => {
    expect(PROFILES.oak.height).toBeGreaterThan(PROFILES['boxwood-ball'].height)
    expect(PROFILES.pine.height).toBeGreaterThan(PROFILES.lavender.height)
    expect(PROFILES['house-red'].height).toBeGreaterThan(PROFILES.bench.height)
  })

  it('falls back to a flat decal for a custom import', () => {
    const custom: AssetDef = {
      id: 'asset_x',
      name: 'Mine',
      category: 'shrubs',
      band: Band.Planting,
      source: 'custom',
      src: 'blob:x',
      defaultSize: { w: 1, h: 1 },
      aspectLocked: true,
      tags: [],
    }
    // Honest: it shows the artwork we have rather than inventing a shape.
    expect(profileFor(custom).model).toBe('decal')
  })

  it('falls back by category for an unknown built-in', () => {
    const unknown: AssetDef = { ...ASSETS.get('oak')!, id: 'not-in-table' }
    expect(profileFor(unknown).model).toBe('treeRound')
  })
})

describe('buildScene placement', () => {
  it('maps plan y onto scene z', () => {
    const { root } = buildScene(doc([object({ x: 3, y: 7 })]), ASSETS, MATERIALS)
    const node = root.children.find((c) => c.position.x === 3)
    expect(node).toBeDefined()
    expect(node!.position.z).toBe(7)
    expect(node!.position.y).toBe(0)
  })

  it('negates rotation, because plan y runs down and scene y-rotation does not', () => {
    const { root } = buildScene(doc([object({ rotation: 90 })]), ASSETS, MATERIALS)
    const node = root.children.at(-1)!
    expect(node.rotation.y).toBeCloseTo(-Math.PI / 2)
  })

  it('builds one node per visible object', () => {
    const objects = [
      object({ id: 'a', assetId: 'oak' }),
      object({ id: 'b', assetId: 'bench', band: Band.Furniture }),
      object({ id: 'c', assetId: 'shed', band: Band.Structure }),
    ]
    const { root } = buildScene(doc(objects), ASSETS, MATERIALS)
    expect(root.children).toHaveLength(3)
  })

  it('skips hidden objects and hidden bands', () => {
    const objects = [
      object({ id: 'a', assetId: 'oak' }),
      object({ id: 'b', assetId: 'bench', band: Band.Furniture, hidden: true }),
      object({ id: 'c', assetId: 'shed', band: Band.Structure }),
    ]
    const { root } = buildScene(doc(objects), ASSETS, MATERIALS, [Band.Structure])
    expect(root.children).toHaveLength(1)
  })

  it('is deterministic — the same plan twice gives identical geometry', () => {
    const plan = doc([object({ assetId: 'oak' })])
    const a = buildScene(plan, ASSETS, MATERIALS)
    const b = buildScene(plan, ASSETS, MATERIALS)
    const positions = (r: THREE.Object3D) =>
      meshesIn(r).map((m) => `${m.position.x.toFixed(4)},${m.position.y.toFixed(4)},${m.position.z.toFixed(4)}`)
    expect(positions(a.root)).toEqual(positions(b.root))
  })

  it('varies between two objects of the same asset, so a row is not a clone army', () => {
    const plan = doc([object({ id: 'a', assetId: 'oak' }), object({ id: 'b', assetId: 'oak', x: 20 })])
    const { root } = buildScene(plan, ASSETS, MATERIALS)
    const [first, second] = root.children
    const local = (n: THREE.Object3D) =>
      n.children.map((c) => `${c.position.x.toFixed(3)},${c.position.z.toFixed(3)}`).join('|')
    expect(local(first)).not.toEqual(local(second))
  })
})

describe('buildScene geometry', () => {
  it('sits everything on or above the ground plane', () => {
    const objects = BUILTIN_ASSETS.slice(0, 40).map((asset, i) =>
      object({ id: `o${i}`, assetId: asset.id, x: i * 20, w: asset.defaultSize.w, h: asset.defaultSize.h }),
    )
    const { root } = buildScene(doc(objects), ASSETS, MATERIALS)
    root.updateMatrixWorld(true)

    const box = new THREE.Box3()
    for (const mesh of meshesIn(root)) {
      mesh.geometry.computeBoundingBox()
      box.setFromObject(mesh)
      // A small tolerance: a few recipes deliberately bed slightly into soil.
      expect(box.min.y).toBeGreaterThan(-0.6)
    }
  })

  it('builds a mesh for every asset in the catalog without throwing', () => {
    for (const asset of BUILTIN_ASSETS) {
      const plan = doc([
        object({ assetId: asset.id, w: asset.defaultSize.w, h: asset.defaultSize.h }),
      ])
      const { root } = buildScene(plan, ASSETS, MATERIALS)
      expect(meshesIn(root).length, `${asset.id} produced no geometry`).toBeGreaterThan(0)
    }
  })

  it('roughly honours the profile height', () => {
    for (const id of ['oak', 'pine', 'house-red', 'bench', 'hedge-tall']) {
      const asset = ASSETS.get(id)!
      const plan = doc([object({ assetId: id, w: asset.defaultSize.w, h: asset.defaultSize.h })])
      const { root } = buildScene(plan, ASSETS, MATERIALS)
      root.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(root)
      const expected = PROFILES[id].height
      // Crowns and roofs overshoot a little; catching order-of-magnitude slips
      // is the point, not millimetre accuracy.
      expect(box.max.y, `${id} height`).toBeGreaterThan(expected * 0.55)
      expect(box.max.y, `${id} height`).toBeLessThan(expected * 1.6)
    }
  })

  it('turns a surface into a flat ground mesh', () => {
    const { root } = buildScene(doc([], [surface('lawn')]), ASSETS, MATERIALS)
    const meshes = meshesIn(root)
    expect(meshes).toHaveLength(1)
    meshes[0].geometry.computeBoundingBox()
    const box = meshes[0].geometry.boundingBox!
    // Laid flat: no vertical extent in the geometry itself.
    expect(box.max.y - box.min.y).toBeCloseTo(0, 5)
  })

  it('carries holes through to the ground mesh', () => {
    const solid = buildScene(doc([], [surface('lawn', false)]), ASSETS, MATERIALS)
    const holed = buildScene(doc([], [surface('lawn', true)]), ASSETS, MATERIALS)
    const count = (r: THREE.Object3D) =>
      meshesIn(r).reduce((n, m) => n + (m.geometry.attributes.position?.count ?? 0), 0)
    // A hole needs more vertices to triangulate around than a plain quad.
    expect(count(holed.root)).toBeGreaterThan(count(solid.root))
  })

  it('reports plan bounds for framing the camera', () => {
    const { bounds } = buildScene(doc([object({ x: 0, y: 0, w: 4, h: 4 })]), ASSETS, MATERIALS)
    expect(bounds.w).toBeGreaterThan(0)
    expect(bounds.h).toBeGreaterThan(0)
  })
})
