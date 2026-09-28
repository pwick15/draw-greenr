import * as THREE from 'three'

import { documentBounds } from '@/state/document'
import { getImage } from '@/core/imageCache'
import { objectZ } from '@/core/picking'
import type { AssetDef, GardenDoc, MaterialDef, Rect } from '@/core/types'
import { Band } from '@/core/types'

import { BUILDERS, sharedMaterial } from './builders'
import { MATERIAL_FALLBACK_COLOUR, profileFor } from './profiles'

/**
 * Turns a plan into a three.js scene.
 *
 * Plan space is x/y with y running down the screen; scene space is x/z on the
 * ground with y up. The mapping is `scene.x = plan.x`, `scene.z = plan.y`,
 * which means a clockwise rotation in plan is a clockwise rotation about the
 * scene's y axis — hence the sign on `rotation.y` below.
 */

/** Deterministic PRNG so the same plan always produces the same scene. */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SceneResult {
  root: THREE.Group
  /** Plan-space bounds of everything built, for framing the camera. */
  bounds: Rect
  /** Objects that fell back to a flat decal, so the UI can say so. */
  decalCount: number
}

const textureCache = new Map<string, THREE.Texture>()

function textureFor(src: string, repeatMetres: number): THREE.Texture | null {
  const loaded = getImage(src)
  if (!loaded) return null
  const key = `${src}:${repeatMetres}`
  const hit = textureCache.get(key)
  if (hit) return hit
  const texture = new THREE.Texture(loaded.image)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  textureCache.set(key, texture)
  return texture
}

export function disposeTextureCache(): void {
  for (const texture of textureCache.values()) texture.dispose()
  textureCache.clear()
}

/** Ground surfaces: one flat mesh per material, holes and all. */
function buildSurfaces(doc: GardenDoc, materials: ReadonlyMap<string, MaterialDef>): THREE.Group {
  const group = new THREE.Group()

  doc.surfaces
    .filter((s) => !s.hidden)
    .sort((a, b) => a.order - b.order)
    .forEach((surface, index) => {
      const material = materials.get(surface.materialId)

      for (const poly of surface.geometry) {
        const [outer, ...holes] = poly
        if (!outer || outer.length < 3) continue

        // THREE.Shape takes holes natively, so the MultiPolygon the plot tool
        // already produces maps across with no triangulation of our own.
        const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
        for (const hole of holes) {
          if (hole.length >= 3) {
            shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
          }
        }

        const geometry = new THREE.ShapeGeometry(shape)
        // ShapeGeometry lies in the XY plane; lay it flat, facing up.
        geometry.rotateX(Math.PI / 2)

        const texture = material?.textureSrc ? textureFor(material.textureSrc, material.textureScale) : null
        let mesh: THREE.Mesh
        if (texture) {
          // ShapeGeometry's UVs come straight from world coordinates, so one
          // texture repeat per `textureScale` metres falls out of a scale.
          const uv = geometry.attributes.uv as THREE.BufferAttribute
          const scale = 1 / (material?.textureScale ?? 2)
          for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale)
          }
          uv.needsUpdate = true
          mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }),
          )
        } else {
          const colour = material?.fill
            ? new THREE.Color(material.fill).getHex()
            : MATERIAL_FALLBACK_COLOUR
          mesh = new THREE.Mesh(geometry, sharedMaterial(colour))
        }

        // Stack materials a millimetre apart to avoid z-fighting where two
        // surfaces share an edge after a boolean op.
        mesh.position.y = 0.001 + index * 0.002
        mesh.receiveShadow = true
        group.add(mesh)
      }
    })

  return group
}

/** An unknown asset: its plan artwork, laid flat on the ground. */
function buildDecal(asset: AssetDef, w: number, d: number): THREE.Object3D | null {
  const loaded = getImage(asset.src)
  if (!loaded) return null
  const texture = new THREE.Texture(loaded.image)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  const geometry = new THREE.PlaneGeometry(w, d)
  geometry.rotateX(Math.PI / 2)
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  )
  mesh.position.y = 0.02
  mesh.receiveShadow = true
  return mesh
}

export function buildScene(
  doc: GardenDoc,
  assets: ReadonlyMap<string, AssetDef>,
  materials: ReadonlyMap<string, MaterialDef>,
  hiddenBands: readonly number[] = [],
): SceneResult {
  const root = new THREE.Group()
  let decalCount = 0

  if (!hiddenBands.includes(Band.Terrain)) {
    const ground = buildSurfaces(doc, materials)
    // Only attach it when it has something in it, so the scene graph stays a
    // faithful list of what was actually built.
    if (ground.children.length > 0) root.add(ground)
  }

  const objects = Object.values(doc.objects)
    .filter((o) => !o.hidden && !hiddenBands.includes(o.band))
    .sort((a, b) => objectZ(a) - objectZ(b))

  for (const object of objects) {
    const asset = assets.get(object.assetId)
    const profile = profileFor(asset)

    let node: THREE.Object3D | null
    if (profile.model === 'decal') {
      node = asset ? buildDecal(asset, object.w, object.h) : null
      if (node) decalCount++
    } else {
      const builder = BUILDERS[profile.model]
      node = builder
        ? builder({ w: object.w, d: object.h, profile, random: seededRandom(object.id) })
        : null
    }
    if (!node) continue

    node.position.x = object.x
    node.position.z = object.y
    // Plan rotation is clockwise with y down; scene y-rotation is
    // counter-clockwise looking down, so the sign flips.
    node.rotation.y = -object.rotation * (Math.PI / 180)
    if (object.opacity < 1) {
      node.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = (child.material as THREE.Material).clone()
          material.transparent = true
          material.opacity = object.opacity
          child.material = material
        }
      })
    }
    root.add(node)
  }

  const planBounds = documentBounds(doc) ?? { x: -10, y: -10, w: 20, h: 20 }
  return { root, bounds: planBounds, decalCount }
}

/** Free every geometry and non-shared material under a node. */
export function disposeScene(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const material = child.material
      // Shared materials live in the builder cache and are disposed with it.
      if (Array.isArray(material)) material.forEach((m) => m.map && m.dispose())
      else if (material.map) material.dispose()
    }
  })
}
