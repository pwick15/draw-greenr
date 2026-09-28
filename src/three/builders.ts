import * as THREE from 'three'

import type { Profile } from './profiles'

/**
 * Procedural geometry, one builder per recipe.
 *
 * Every builder returns an Object3D sitting on the ground plane (y = 0) and
 * centred on the origin, sized to the footprint it is given in metres. The
 * caller positions and rotates it. Nothing here loads a model file: the 2D
 * library is generated, so the 3D one is generated too, which keeps the two
 * consistent and means a new asset never needs a modelling round-trip.
 *
 * Coordinates: the plan is x/y with y running *down* the screen; three.js is
 * x/z on the ground with y up. The caller maps plan y to scene z.
 */

export interface BuildContext {
  /** Footprint width in metres (plan x). */
  w: number
  /** Footprint depth in metres (plan y). */
  d: number
  profile: Profile
  /** Deterministic 0..1 source, seeded per object so scenes are stable. */
  random: () => number
}

type Builder = (ctx: BuildContext) => THREE.Object3D

// Materials are shared by colour: a garden reuses a handful of greens across
// hundreds of objects, and a material per mesh would cost far more than the
// geometry does.
const materialCache = new Map<string, THREE.MeshLambertMaterial>()

function mat(colour: number, opts: { flat?: boolean; opacity?: number } = {}): THREE.MeshLambertMaterial {
  const key = `${colour}:${opts.flat ? 1 : 0}:${opts.opacity ?? 1}`
  const hit = materialCache.get(key)
  if (hit) return hit
  const material = new THREE.MeshLambertMaterial({
    color: colour,
    flatShading: opts.flat ?? false,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
  })
  materialCache.set(key, material)
  return material
}

export function disposeMaterialCache(): void {
  for (const material of materialCache.values()) material.dispose()
  materialCache.clear()
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.position.y = y
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const jitter = (random: () => number, amount: number) => (random() - 0.5) * 2 * amount

// ---------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------

/**
 * A broadleaf tree: bare trunk, then overlapping spheres for the crown. The
 * crown spreads to the asset's plan footprint, which is what the 2D view
 * already committed to, so the two views agree about how much ground it takes.
 */
const treeRound: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const spread = Math.max(w, d)
  const height = profile.height
  const trunkFraction = profile.trunk ?? 0.35
  const trunkHeight = height * trunkFraction
  const trunkRadius = Math.max(0.05, spread * 0.035)

  group.add(
    mesh(
      new THREE.CylinderGeometry(trunkRadius * 0.75, trunkRadius, trunkHeight, 7),
      mat(profile.accent ?? 0x6b4f3a),
      trunkHeight / 2,
    ),
  )

  const crownHeight = height - trunkHeight
  const crownCentre = trunkHeight + crownHeight * 0.45
  const radius = spread / 2

  const blobs = 5
  for (let i = 0; i < blobs; i++) {
    const first = i === 0
    const r = first ? radius * 0.72 : radius * (0.42 + random() * 0.26)
    const angle = (i / blobs) * Math.PI * 2 + jitter(random, 0.5)
    const dist = first ? 0 : radius * 0.38 * (0.6 + random() * 0.6)
    const sphere = mesh(
      new THREE.SphereGeometry(r, 8, 6),
      mat(profile.colour ?? 0x5e9e4a, { flat: true }),
      crownCentre + (first ? crownHeight * 0.1 : jitter(random, crownHeight * 0.22)),
    )
    sphere.position.x = Math.cos(angle) * dist
    sphere.position.z = Math.sin(angle) * dist
    // Crowns are wider than they are tall; a bare sphere reads as a lollipop.
    sphere.scale.y = 0.82
    group.add(sphere)
  }

  if (profile.bloom !== undefined) {
    const bloomGeometry = new THREE.SphereGeometry(radius * 0.09, 5, 4)
    const bloomMat = mat(profile.bloom, { flat: true })
    for (let i = 0; i < 14; i++) {
      const angle = random() * Math.PI * 2
      const dist = radius * (0.45 + random() * 0.5)
      const blossom = mesh(
        bloomGeometry,
        bloomMat,
        crownCentre + jitter(random, crownHeight * 0.32),
      )
      blossom.position.x = Math.cos(angle) * dist
      blossom.position.z = Math.sin(angle) * dist
      group.add(blossom)
    }
  }

  return group
}

/** A conifer: stacked cones, widest at the bottom. */
const treeConifer: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const spread = Math.max(w, d)
  const height = profile.height
  const trunkHeight = height * (profile.trunk ?? 0.15)

  group.add(
    mesh(
      new THREE.CylinderGeometry(spread * 0.03, spread * 0.045, trunkHeight + height * 0.1, 6),
      mat(profile.accent ?? 0x6b4f3a),
      (trunkHeight + height * 0.1) / 2,
    ),
  )

  const tiers = 3
  const canopyHeight = height - trunkHeight
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const radius = (spread / 2) * (1 - t * 0.45)
    const tierHeight = canopyHeight * 0.5
    const base = trunkHeight + canopyHeight * t * 0.55
    const cone = mesh(
      new THREE.ConeGeometry(radius, tierHeight, 8),
      mat(profile.colour ?? 0x2f5d45, { flat: true }),
      base + tierHeight / 2,
    )
    cone.rotation.y = random() * Math.PI
    group.add(cone)
  }
  return group
}

/** A palm or tree fern: clear trunk, then fronds fanning out from the top. */
const treePalm: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const spread = Math.max(w, d)
  const height = profile.height
  const trunkHeight = height * (profile.trunk ?? 0.6)

  group.add(
    mesh(
      new THREE.CylinderGeometry(spread * 0.035, spread * 0.055, trunkHeight, 7),
      mat(profile.accent ?? 0x9b7f5a),
      trunkHeight / 2,
    ),
  )

  const fronds = 9
  const frondLength = spread * 0.5
  const frondGeometry = new THREE.BoxGeometry(frondLength, 0.05, frondLength * 0.22)
  const frondMat = mat(profile.colour ?? 0x4f8f4a, { flat: true })
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + jitter(random, 0.15)
    const frond = mesh(frondGeometry, frondMat, trunkHeight + height * 0.06)
    // Anchor at the crown and sweep outward, drooping at the tip.
    frond.position.x = Math.cos(angle) * frondLength * 0.5
    frond.position.z = Math.sin(angle) * frondLength * 0.5
    frond.rotation.y = -angle
    frond.rotation.z = -0.25 - random() * 0.2
    group.add(frond)
  }
  return group
}

/** A rounded mound. Covers everything from a box ball to a rose bush. */
const shrub: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  const material = mat(profile.colour ?? 0x3f7a3a, { flat: true })

  const blobs = 3
  for (let i = 0; i < blobs; i++) {
    const first = i === 0
    const rx = (w / 2) * (first ? 0.9 : 0.55 + random() * 0.25)
    const rz = (d / 2) * (first ? 0.9 : 0.55 + random() * 0.25)
    const sphere = mesh(new THREE.SphereGeometry(1, 8, 6), material, height * (first ? 0.5 : 0.42))
    sphere.scale.set(rx, height * (first ? 0.52 : 0.4), rz)
    if (!first) {
      const angle = random() * Math.PI * 2
      sphere.position.x = Math.cos(angle) * w * 0.18
      sphere.position.z = Math.sin(angle) * d * 0.18
    }
    group.add(sphere)
  }

  if (profile.bloom !== undefined) {
    const bloomGeometry = new THREE.SphereGeometry(Math.min(w, d) * 0.07, 5, 4)
    const bloomMat = mat(profile.bloom, { flat: true })
    for (let i = 0; i < 12; i++) {
      const angle = random() * Math.PI * 2
      const blossom = mesh(bloomGeometry, bloomMat, height * (0.55 + random() * 0.4))
      blossom.position.x = Math.cos(angle) * (w / 2) * random() * 0.8
      blossom.position.z = Math.sin(angle) * (d / 2) * random() * 0.8
      group.add(blossom)
    }
  }
  return group
}

/** Upright blades fanning from a tuft. */
const grassTuft: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  const material = mat(profile.colour ?? 0x8aa05a, { flat: true })
  const blades = 14
  const geometry = new THREE.ConeGeometry(Math.min(w, d) * 0.08, height, 4)

  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + jitter(random, 0.4)
    const lean = 0.12 + random() * 0.3
    const blade = mesh(geometry, material, height * 0.5 * (0.7 + random() * 0.5))
    blade.position.x = Math.cos(angle) * (w / 2) * 0.3
    blade.position.z = Math.sin(angle) * (d / 2) * 0.3
    blade.rotation.z = Math.cos(angle) * lean
    blade.rotation.x = -Math.sin(angle) * lean
    blade.scale.y = 0.7 + random() * 0.6
    group.add(blade)
  }
  return group
}

/** A clipped hedge. */
const hedge: Builder = ({ w, d, profile }) =>
  mesh(
    new THREE.BoxGeometry(w, profile.height, d),
    mat(profile.colour ?? 0x2f5f3c, { flat: true }),
    profile.height / 2,
  )

/** Climbers on a trellis: a thin panel with foliage clinging to it. */
const trellis: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  group.add(mesh(new THREE.BoxGeometry(w, height, d * 0.35), mat(profile.accent ?? 0x7d5a3c), height / 2))
  const foliage = mat(profile.colour ?? 0x3f7a3a, { flat: true })
  for (let i = 0; i < 10; i++) {
    const blob = mesh(new THREE.SphereGeometry(Math.min(w, height) * 0.16, 6, 5), foliage, height * random())
    blob.position.x = (random() - 0.5) * w
    blob.position.z = (random() - 0.5) * d * 0.5
    group.add(blob)
  }
  return group
}

/** A low mat of foliage with flower heads over it. */
const flowerBed: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  const soil = mesh(new THREE.BoxGeometry(w, height * 0.25, d), mat(0x4a3a2c), height * 0.12)
  group.add(soil)

  const foliage = mat(profile.colour ?? 0x6f9a52, { flat: true })
  const clumps = Math.max(5, Math.round(w * d * 2.5))
  for (let i = 0; i < clumps; i++) {
    const r = Math.min(w, d) * (0.14 + random() * 0.1)
    const clump = mesh(new THREE.SphereGeometry(r, 6, 5), foliage, height * 0.45)
    clump.position.x = (random() - 0.5) * (w - r * 2)
    clump.position.z = (random() - 0.5) * (d - r * 2)
    clump.scale.y = 0.75
    group.add(clump)
  }

  if (profile.bloom !== undefined) {
    const bloomMat = mat(profile.bloom, { flat: true })
    const bloomGeometry = new THREE.SphereGeometry(Math.min(w, d) * 0.055, 5, 4)
    for (let i = 0; i < clumps * 2; i++) {
      const blossom = mesh(bloomGeometry, bloomMat, height * (0.7 + random() * 0.45))
      blossom.position.x = (random() - 0.5) * w * 0.9
      blossom.position.z = (random() - 0.5) * d * 0.9
      group.add(blossom)
    }
  }
  return group
}

/** A timber-framed raised bed with rows of plants. */
const vegBed: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  const frame = mat(profile.accent ?? 0xc49a68)
  const thickness = Math.min(w, d) * 0.08

  const front = mesh(new THREE.BoxGeometry(w, height, thickness), frame, height / 2)
  front.position.z = -d / 2
  group.add(front)
  const back = mesh(new THREE.BoxGeometry(w, height, thickness), frame, height / 2)
  back.position.z = d / 2
  group.add(back)
  const left = mesh(new THREE.BoxGeometry(thickness, height, d), frame, height / 2)
  left.position.x = -w / 2
  group.add(left)
  const right = mesh(new THREE.BoxGeometry(thickness, height, d), frame, height / 2)
  right.position.x = w / 2
  group.add(right)

  group.add(mesh(new THREE.BoxGeometry(w - thickness, height * 0.8, d - thickness), mat(0x4a3a2c), height * 0.4))

  const crop = mat(profile.colour ?? 0x6f9a52, { flat: true })
  const rows = 3
  const perRow = Math.max(2, Math.round(w / 0.5))
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const plant = mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.1, 6, 5), crop, height * 0.95)
      plant.position.x = -w / 2 + ((i + 0.5) * w) / perRow
      plant.position.z = -d / 2 + ((r + 0.5) * d) / rows + jitter(random, 0.03)
      plant.scale.y = 0.7
      group.add(plant)
    }
  }
  return group
}

/** A tapered pot with a plant in it. */
const pot: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const height = profile.height
  const radius = Math.min(w, d) / 2
  const potHeight = height * 0.38
  group.add(
    mesh(
      new THREE.CylinderGeometry(radius, radius * 0.72, potHeight, 10),
      mat(profile.accent ?? 0xb5734f),
      potHeight / 2,
    ),
  )
  const foliage = mat(profile.colour ?? 0x5e9e4a, { flat: true })
  const crown = mesh(new THREE.SphereGeometry(radius * 0.95, 7, 6), foliage, potHeight + (height - potHeight) * 0.45)
  crown.scale.y = (height - potHeight) / (radius * 1.9)
  group.add(crown)
  for (let i = 0; i < 3; i++) {
    const extra = mesh(new THREE.SphereGeometry(radius * 0.55, 6, 5), foliage, potHeight + (height - potHeight) * (0.4 + random() * 0.4))
    const angle = random() * Math.PI * 2
    extra.position.x = Math.cos(angle) * radius * 0.5
    extra.position.z = Math.sin(angle) * radius * 0.5
    group.add(extra)
  }
  return group
}

// ---------------------------------------------------------------------------
// Built form
// ---------------------------------------------------------------------------

/** Walls plus a gabled roof. `trunk: 0` gives a flat roof instead. */
const house: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const flat = profile.trunk === 0
  const wallHeight = flat ? height : height * 0.62
  const roofHeight = height - wallHeight

  group.add(mesh(new THREE.BoxGeometry(w, wallHeight, d), mat(profile.accent ?? 0xe8e2d6), wallHeight / 2))

  if (flat) {
    const cap = mesh(new THREE.BoxGeometry(w * 1.04, height * 0.06, d * 1.04), mat(profile.colour ?? 0x8b9298), height)
    group.add(cap)
    return group
  }

  // A 4-sided cone rotated 45 degrees is a pyramid; scaling one axis to zero
  // width at the ridge would need custom geometry, so use a prism instead.
  const roof = new THREE.Mesh(prismGeometry(w * 1.06, roofHeight, d * 1.06), mat(profile.colour ?? 0xa8503f, { flat: true }))
  roof.position.y = wallHeight
  roof.castShadow = true
  roof.receiveShadow = true
  group.add(roof)

  const chimney = mesh(
    new THREE.BoxGeometry(Math.min(w, d) * 0.12, height * 0.22, Math.min(w, d) * 0.12),
    mat(profile.colour ?? 0xa8503f),
    wallHeight + roofHeight * 0.8,
  )
  chimney.position.x = -w * 0.28
  chimney.position.z = d * 0.12
  group.add(chimney)
  return group
}

/**
 * A triangular prism ridged along x — the roof shape. Built by hand because
 * three.js has no primitive for it and ExtrudeGeometry would be heavier.
 */
function prismGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const hw = width / 2
  const hd = depth / 2
  const vertices = new Float32Array([
    // Front slope
    -hw, 0, hd, hw, 0, hd, hw, height, 0, -hw, 0, hd, hw, height, 0, -hw, height, 0,
    // Back slope
    hw, 0, -hd, -hw, 0, -hd, -hw, height, 0, hw, 0, -hd, -hw, height, 0, hw, height, 0,
    // Left gable
    -hw, 0, hd, -hw, height, 0, -hw, 0, -hd,
    // Right gable
    hw, 0, -hd, hw, height, 0, hw, 0, hd,
    // Underside
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** A small outbuilding: shed, greenhouse, playhouse. */
const shed: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const wallHeight = height * 0.7
  const glass = (profile.colour ?? 0) === 0xbfd9dd
  group.add(
    mesh(
      new THREE.BoxGeometry(w, wallHeight, d),
      glass ? mat(profile.colour ?? 0xbfd9dd, { opacity: 0.55 }) : mat(profile.accent ?? 0xefe8da),
      wallHeight / 2,
    ),
  )
  const roof = new THREE.Mesh(
    prismGeometry(w * 1.08, height - wallHeight, d * 1.08),
    mat(glass ? 0xdfe6e4 : (profile.colour ?? 0x9a5f45), { flat: true }),
  )
  roof.position.y = wallHeight
  roof.castShadow = true
  group.add(roof)
  return group
}

/** A raised flat platform: decking, a carport deck. */
const flatDeck: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const top = Math.max(0.08, height * 0.12)
  group.add(mesh(new THREE.BoxGeometry(w, top, d), mat(profile.colour ?? 0xc49a68), height - top / 2))
  if (height > 0.6) {
    // Tall enough to be a carport: it needs legs, not a floating slab.
    const leg = new THREE.BoxGeometry(0.12, height, 0.12)
    const legMat = mat(profile.colour ?? 0xc49a68)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = mesh(leg, legMat, height / 2)
        post.position.x = (sx * (w - 0.2)) / 2
        post.position.z = (sz * (d - 0.2)) / 2
        group.add(post)
      }
    }
  }
  return group
}

const stairs: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const treads = 4
  const material = mat(profile.colour ?? 0x6f7a80)
  for (let i = 0; i < treads; i++) {
    const h = (profile.height / treads) * (i + 1)
    const step = mesh(new THREE.BoxGeometry(w, h, d / treads), material, h / 2)
    step.position.z = -d / 2 + (d / treads) * (i + 0.5)
    group.add(step)
  }
  return group
}

const fence: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const material = mat(profile.colour ?? 0x7d5a3c)
  const thickness = Math.max(0.05, d * 0.5)

  for (const t of [0.35, 0.75]) {
    group.add(mesh(new THREE.BoxGeometry(w, height * 0.1, thickness), material, height * t))
  }
  const posts = Math.max(2, Math.round(w / 1.8) + 1)
  for (let i = 0; i < posts; i++) {
    const post = mesh(new THREE.BoxGeometry(thickness * 1.4, height, thickness * 1.4), material, height / 2)
    post.position.x = -w / 2 + (w * i) / (posts - 1)
    group.add(post)
  }
  return group
}

const wall: Builder = ({ w, d, profile }) =>
  mesh(new THREE.BoxGeometry(w, profile.height, d), mat(profile.colour ?? 0x9aa0a4, { flat: true }), profile.height / 2)

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

const tableSet: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const top = mat(profile.colour ?? 0xc49a68)
  const frame = mat(profile.accent ?? 0x7d5a3c)
  const round = Math.abs(w - d) < 0.3

  const tableW = w * 0.5
  const tableD = d * 0.5
  if (round) {
    group.add(mesh(new THREE.CylinderGeometry(tableW / 2, tableW / 2, 0.08, 14), top, height))
    group.add(mesh(new THREE.CylinderGeometry(0.06, 0.12, height, 8), frame, height / 2))
  } else {
    group.add(mesh(new THREE.BoxGeometry(tableW, 0.08, tableD), top, height))
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = mesh(new THREE.BoxGeometry(0.07, height, 0.07), frame, height / 2)
        leg.position.x = (sx * (tableW - 0.16)) / 2
        leg.position.z = (sz * (tableD - 0.16)) / 2
        group.add(leg)
      }
    }
  }

  // Chairs around the table: seat pad plus a back, enough to read at this size.
  const seats = round ? 6 : 6
  const ring = Math.max(tableW, tableD) / 2 + 0.34
  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * Math.PI * 2
    const chair = new THREE.Group()
    chair.add(mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), top, height * 0.58))
    const back = mesh(new THREE.BoxGeometry(0.42, height * 0.5, 0.06), frame, height * 0.85)
    back.position.z = 0.2
    chair.add(back)
    chair.position.x = Math.cos(angle) * ring
    chair.position.z = Math.sin(angle) * ring
    chair.rotation.y = -angle + Math.PI / 2
    group.add(chair)
  }
  return group
}

const bench: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const seat = height * 0.5
  const slats = mat(profile.colour ?? 0xc49a68)
  group.add(mesh(new THREE.BoxGeometry(w, 0.07, d * 0.8), slats, seat))
  const back = mesh(new THREE.BoxGeometry(w, height * 0.45, 0.07), slats, height * 0.75)
  back.position.z = -d * 0.35
  group.add(back)
  const legMat = mat(profile.accent ?? 0x7d5a3c)
  for (const sx of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, seat, d * 0.7), legMat, seat / 2)
    leg.position.x = (sx * (w - 0.3)) / 2
    group.add(leg)
  }
  return group
}

const lounger: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const frame = mat(profile.accent ?? 0x9aa0a4)
  const pad = mat(profile.colour ?? 0xc65f4e)
  group.add(mesh(new THREE.BoxGeometry(w * 0.9, 0.1, d * 0.92), pad, height * 0.55))
  // Raked backrest at the head end.
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.1, d * 0.42), pad)
  back.position.set(0, height * 0.75, -d * 0.3)
  back.rotation.x = -0.6
  back.castShadow = true
  group.add(back)
  for (const sz of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(w * 0.85, height * 0.5, 0.07), frame, height * 0.27)
    leg.position.z = (sz * d * 0.7) / 2
    group.add(leg)
  }
  return group
}

const parasol: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const radius = Math.max(w, d) / 2
  group.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, height, 8), mat(profile.accent ?? 0x8a8f93), height / 2))
  group.add(mesh(new THREE.ConeGeometry(radius, height * 0.28, 8), mat(profile.colour ?? 0xe4d2a8, { flat: true }), height * 0.88))
  group.add(mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.06, 10), mat(profile.accent ?? 0x8a8f93), 0.03))
  return group
}

const box: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  group.add(mesh(new THREE.BoxGeometry(w, height, d), mat(profile.colour ?? 0x3c3f42, { flat: true }), height / 2))
  if (profile.accent !== undefined) {
    // A rim, which is what turns a plain box into a sandpit or a planter.
    group.add(mesh(new THREE.BoxGeometry(w * 1.04, height * 0.18, d * 1.04), mat(profile.accent), height))
  }
  return group
}

const firepit: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const radius = Math.min(w, d) / 2
  group.add(mesh(new THREE.CylinderGeometry(radius, radius * 1.05, profile.height, 12), mat(profile.colour ?? 0x9aa0a4, { flat: true }), profile.height / 2))
  group.add(mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.04, 10), mat(profile.accent ?? 0xe07a2f), profile.height))
  return group
}

const trampoline: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const radius = Math.min(w, d) / 2
  group.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.1, 16), mat(profile.colour ?? 0x2b3238), height))
  group.add(mesh(new THREE.TorusGeometry(radius, 0.07, 6, 16).rotateX(Math.PI / 2), mat(profile.accent ?? 0x6d757c), height))
  const legMat = mat(profile.accent ?? 0x6d757c)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
    const leg = mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 6), legMat, height / 2)
    leg.position.x = Math.cos(angle) * radius * 0.85
    leg.position.z = Math.sin(angle) * radius * 0.85
    group.add(leg)
  }
  return group
}

const car: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const body = mat(profile.colour ?? 0x4a6f9a)
  group.add(mesh(new THREE.BoxGeometry(w, height * 0.45, d * 0.96), body, height * 0.35))
  group.add(mesh(new THREE.BoxGeometry(w * 0.82, height * 0.35, d * 0.5), body, height * 0.72))
  const tyre = new THREE.CylinderGeometry(height * 0.2, height * 0.2, 0.18, 10).rotateZ(Math.PI / 2)
  const tyreMat = mat(profile.accent ?? 0x2c3238)
  for (const sx of [-1, 1]) {
    for (const sz of [-0.62, 0.62]) {
      const wheel = mesh(tyre, tyreMat, height * 0.2)
      wheel.position.x = (sx * w) / 2
      wheel.position.z = sz * (d / 2)
      group.add(wheel)
    }
  }
  return group
}

/** A sunken water body with a margin around it. */
const water: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const margin = mesh(
    new THREE.BoxGeometry(w, profile.height, d),
    mat(profile.accent ?? 0x7d8f5e, { flat: true }),
    profile.height / 2,
  )
  group.add(margin)
  const surface = mesh(
    new THREE.BoxGeometry(w * 0.86, profile.height * 0.5, d * 0.86),
    mat(profile.colour ?? 0x4a92ad, { opacity: 0.92 }),
    profile.height * 0.75,
  )
  group.add(surface)
  return group
}

const birdbath: Builder = ({ w, d, profile }) => {
  const group = new THREE.Group()
  const height = profile.height
  const radius = Math.min(w, d) / 2
  group.add(mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.4, height * 0.8, 8), mat(profile.colour ?? 0xbdbdb6), height * 0.4))
  group.add(mesh(new THREE.CylinderGeometry(radius, radius * 0.75, height * 0.2, 12), mat(profile.colour ?? 0xbdbdb6), height * 0.9))
  group.add(mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.03, 12), mat(profile.accent ?? 0x6aa8c4), height))
  return group
}

const stones: Builder = ({ w, d, profile, random }) => {
  const group = new THREE.Group()
  const count = Math.max(2, Math.round(w / 0.6))
  const material = mat(profile.colour ?? 0x9aa0a4, { flat: true })
  for (let i = 0; i < count; i++) {
    const r = Math.min(d, w / count) * 0.42
    const stone = mesh(new THREE.CylinderGeometry(r, r * 0.9, profile.height, 7), material, profile.height / 2)
    stone.position.x = -w / 2 + ((i + 0.5) * w) / count
    stone.position.z = jitter(random, d * 0.2)
    stone.rotation.y = random() * Math.PI
    group.add(stone)
  }
  return group
}

// ---------------------------------------------------------------------------

export const BUILDERS: Record<string, Builder> = {
  treeRound,
  treeConifer,
  treePalm,
  shrub,
  grassTuft,
  hedge,
  trellis,
  flowerBed,
  vegBed,
  pot,
  house,
  shed,
  flatDeck,
  stairs,
  fence,
  wall,
  tableSet,
  bench,
  lounger,
  parasol,
  box,
  firepit,
  trampoline,
  car,
  water,
  birdbath,
  stones,
}

export { mat as sharedMaterial }
