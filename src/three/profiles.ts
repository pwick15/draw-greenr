import { Band, type AssetDef } from '@/core/types'

/**
 * How each asset becomes geometry in the isometric view.
 *
 * The 2D catalog stays unaware of 3D: this table is keyed by asset id and
 * lives entirely inside `src/three`. Adding a 2D asset without touching this
 * file is fine — it falls back by category and band, and the fallback is
 * deliberately something honest rather than something wrong.
 *
 * Heights are real metres at maturity. A garden reads wrong when everything is
 * the same height, and heights are the one thing a plan view cannot show.
 */

export type ModelKind =
  | 'treeRound'
  | 'treeConifer'
  | 'treePalm'
  | 'shrub'
  | 'grassTuft'
  | 'hedge'
  | 'trellis'
  | 'flowerBed'
  | 'vegBed'
  | 'pot'
  | 'house'
  | 'shed'
  | 'flatDeck'
  | 'stairs'
  | 'fence'
  | 'wall'
  | 'tableSet'
  | 'bench'
  | 'lounger'
  | 'parasol'
  | 'box'
  | 'firepit'
  | 'trampoline'
  | 'car'
  | 'water'
  | 'birdbath'
  | 'stones'
  /** Unknown asset: lay its plan artwork flat on the ground as a decal. */
  | 'decal'

export interface Profile {
  model: ModelKind
  /** Overall height in metres. */
  height: number
  /** Primary colour — foliage, roof, body. */
  colour?: number
  /** Secondary colour — trunk, trim, cushions. */
  accent?: number
  /** Fraction of height taken by the trunk or base, 0..1. */
  trunk?: number
  /** Flowers scattered over foliage, when set. */
  bloom?: number
}

const GREEN = 0x5e9e4a
const DEEP_GREEN = 0x3f7a3a
const DARK_GREEN = 0x2f5f3c
const OLIVE = 0x8aa05a
const SILVER = 0x9db39a
const AUTUMN = 0xd08a3a
const PURPLE = 0x7b4b78
const BARK = 0x6b4f3a
const TIMBER = 0xc49a68
const DARK_TIMBER = 0x7d5a3c
const STONE = 0x9aa0a4
const SLATE = 0x6f7a80
const BRICK = 0xa8503f

export const PROFILES: Record<string, Profile> = {
  // --- trees -------------------------------------------------------------
  oak: { model: 'treeRound', height: 12, colour: GREEN, accent: BARK, trunk: 0.38 },
  maple: { model: 'treeRound', height: 9, colour: 0x57933f, accent: BARK, trunk: 0.36 },
  birch: { model: 'treeRound', height: 8, colour: 0x86b556, accent: 0xd8d4c8, trunk: 0.45 },
  lime: { model: 'treeRound', height: 11, colour: 0x6da04a, accent: BARK, trunk: 0.4 },
  cherry: { model: 'treeRound', height: 6, colour: 0x6f9e5c, accent: BARK, trunk: 0.36, bloom: 0xf0a9c4 },
  apple: { model: 'treeRound', height: 4.5, colour: 0x5d9145, accent: BARK, trunk: 0.34, bloom: 0xd9534f },
  magnolia: { model: 'treeRound', height: 5, colour: 0x5a8a50, accent: BARK, trunk: 0.32, bloom: 0xf3ece0 },
  'japanese-maple': { model: 'treeRound', height: 4, colour: PURPLE, accent: BARK, trunk: 0.3 },
  olive: { model: 'treeRound', height: 5, colour: SILVER, accent: 0x8a7a63, trunk: 0.4 },
  'autumn-tree': { model: 'treeRound', height: 8, colour: AUTUMN, accent: BARK, trunk: 0.38 },
  pine: { model: 'treeConifer', height: 12, colour: 0x2f5d45, accent: BARK, trunk: 0.18 },
  spruce: { model: 'treeConifer', height: 10, colour: 0x27503c, accent: BARK, trunk: 0.12 },
  cypress: { model: 'treeConifer', height: 6, colour: 0x2b563f, accent: BARK, trunk: 0.08 },
  palm: { model: 'treePalm', height: 7, colour: 0x4f8f4a, accent: 0x9b7f5a, trunk: 0.62 },
  'tree-fern': { model: 'treePalm', height: 3, colour: DARK_GREEN, accent: 0x7a6248, trunk: 0.5 },

  // --- shrubs and grasses ------------------------------------------------
  'boxwood-ball': { model: 'shrub', height: 0.9, colour: DEEP_GREEN },
  'boxwood-large': { model: 'shrub', height: 1.6, colour: 0x3c7040 },
  lavender: { model: 'shrub', height: 0.7, colour: SILVER, bloom: 0x8e7ac4 },
  hydrangea: { model: 'shrub', height: 1.3, colour: 0x72a85c, bloom: 0x7fa6dd },
  'rose-bush': { model: 'shrub', height: 1.1, colour: 0x4b8040, bloom: 0xcf4436 },
  rhododendron: { model: 'shrub', height: 1.7, colour: DARK_GREEN, bloom: 0xe089b0 },
  viburnum: { model: 'shrub', height: 1.5, colour: 0x5c9247, bloom: 0xf2ede2 },
  'ornamental-grass': { model: 'grassTuft', height: 1.1, colour: OLIVE },
  'pampas-grass': { model: 'grassTuft', height: 2, colour: 0xc8bb86 },
  fern: { model: 'grassTuft', height: 0.9, colour: 0x3f7347 },
  hosta: { model: 'grassTuft', height: 0.6, colour: 0x7f9a5c },
  'hedge-2m': { model: 'hedge', height: 1.2, colour: DARK_GREEN },
  'hedge-4m': { model: 'hedge', height: 1.2, colour: DARK_GREEN },
  'hedge-tall': { model: 'hedge', height: 1.9, colour: 0x2d5b38 },
  'climber-trellis': { model: 'trellis', height: 2, colour: DEEP_GREEN, accent: DARK_TIMBER },

  // --- beds ---------------------------------------------------------------
  'flower-bed-round': { model: 'flowerBed', height: 0.45, colour: 0x6f9a52, bloom: 0xe0873a },
  'flower-bed-long': { model: 'flowerBed', height: 0.45, colour: 0x6f9a52, bloom: 0x9b73c4 },
  'wildflower-drift': { model: 'flowerBed', height: 0.5, colour: 0x7ba35a, bloom: 0xe8c44a },
  'rose-bed': { model: 'flowerBed', height: 0.6, colour: 0x568043, bloom: 0xcf4436 },
  'veg-bed': { model: 'vegBed', height: 0.4, colour: 0x6f9a52, accent: TIMBER },
  'veg-bed-small': { model: 'vegBed', height: 0.35, colour: 0x6f9a52, accent: TIMBER },
  'potted-plant': { model: 'pot', height: 0.6, colour: GREEN, accent: 0xb5734f },
  'potted-tree': { model: 'pot', height: 1.6, colour: DEEP_GREEN, accent: 0x8d8a85 },

  // --- structures ---------------------------------------------------------
  'house-red': { model: 'house', height: 6.5, colour: BRICK, accent: 0xe8e2d6 },
  'house-grey': { model: 'house', height: 6.5, colour: SLATE, accent: 0xe8e2d6 },
  'house-green': { model: 'house', height: 6.5, colour: 0x6f8f4a, accent: 0xe8e2d6 },
  'house-flat': { model: 'house', height: 5.5, colour: 0x8b9298, accent: 0xe8e2d6, trunk: 0 },
  'house-small': { model: 'house', height: 5, colour: 0xb07040, accent: 0xefe8da },
  garage: { model: 'house', height: 3, colour: SLATE, accent: 0xe0dad0 },
  carport: { model: 'flatDeck', height: 2.4, colour: TIMBER },
  shed: { model: 'shed', height: 2.4, colour: 0x9a5f45, accent: DARK_TIMBER },
  greenhouse: { model: 'shed', height: 2.6, colour: 0xbfd9dd, accent: 0xdfe6e4 },
  deck: { model: 'flatDeck', height: 0.35, colour: TIMBER },
  'stairs-straight': { model: 'stairs', height: 0.9, colour: SLATE },
  'stairs-fan': { model: 'stairs', height: 0.9, colour: SLATE },

  // --- boundaries ---------------------------------------------------------
  'fence-2m': { model: 'fence', height: 1.5, colour: DARK_TIMBER },
  'fence-4m': { model: 'fence', height: 1.5, colour: DARK_TIMBER },
  'wall-2m': { model: 'wall', height: 0.8, colour: STONE },
  'wall-4m': { model: 'wall', height: 0.8, colour: STONE },

  // --- furniture ----------------------------------------------------------
  'dining-set-6': { model: 'tableSet', height: 0.75, colour: TIMBER, accent: DARK_TIMBER },
  'dining-set-round': { model: 'tableSet', height: 0.75, colour: TIMBER, accent: DARK_TIMBER },
  'bistro-set': { model: 'tableSet', height: 0.72, colour: 0x8b9095, accent: 0x6c7176 },
  bench: { model: 'bench', height: 0.85, colour: TIMBER, accent: DARK_TIMBER },
  lounger: { model: 'lounger', height: 0.6, colour: 0xc65f4e, accent: 0x9aa0a4 },
  parasol: { model: 'parasol', height: 2.4, colour: 0xe4d2a8, accent: 0x8a8f93 },
  grill: { model: 'box', height: 1.1, colour: 0x3c3f42 },
  firepit: { model: 'firepit', height: 0.4, colour: STONE, accent: 0xe07a2f },
  trampoline: { model: 'trampoline', height: 0.9, colour: 0x2b3238, accent: 0x6d757c },
  sandbox: { model: 'box', height: 0.35, colour: 0xe3cf9a, accent: TIMBER },
  playhouse: { model: 'shed', height: 1.9, colour: 0xb4503f, accent: 0xefe8da },
  car: { model: 'car', height: 1.5, colour: 0x4a6f9a, accent: 0x2c3238 },
  compost: { model: 'box', height: 1, colour: 0x4a5a3c },

  // --- water --------------------------------------------------------------
  'pond-natural': { model: 'water', height: 0.1, colour: 0x4a92ad, accent: 0x7d8f5e },
  'pond-small': { model: 'water', height: 0.1, colour: 0x4a92ad, accent: 0x7d8f5e },
  'pool-rect': { model: 'water', height: 0.2, colour: 0x3fa8cf, accent: 0xdcd6c8 },
  'pool-round': { model: 'water', height: 0.2, colour: 0x3fa8cf, accent: 0xdcd6c8 },
  birdbath: { model: 'birdbath', height: 0.9, colour: 0xbdbdb6, accent: 0x6aa8c4 },

  // --- ground -------------------------------------------------------------
  'stepping-stones': { model: 'stones', height: 0.06, colour: STONE },
}

/** Sensible guesses when an asset has no entry — including custom imports. */
const CATEGORY_FALLBACK: Record<string, Profile> = {
  trees: { model: 'treeRound', height: 6, colour: GREEN, accent: BARK, trunk: 0.35 },
  shrubs: { model: 'shrub', height: 1.2, colour: DEEP_GREEN },
  beds: { model: 'flowerBed', height: 0.4, colour: 0x6f9a52, bloom: 0xe0873a },
  structures: { model: 'house', height: 3, colour: SLATE, accent: 0xe8e2d6 },
  boundaries: { model: 'fence', height: 1.4, colour: DARK_TIMBER },
  furniture: { model: 'box', height: 0.8, colour: TIMBER },
  water: { model: 'water', height: 0.1, colour: 0x4a92ad },
  ground: { model: 'stones', height: 0.06, colour: STONE },
}

const BAND_FALLBACK: Partial<Record<number, Profile>> = {
  [Band.Ground]: { model: 'decal', height: 0.02 },
  [Band.Water]: { model: 'water', height: 0.1, colour: 0x4a92ad },
  [Band.Structure]: { model: 'box', height: 2.4, colour: STONE },
  [Band.Furniture]: { model: 'box', height: 0.8, colour: TIMBER },
  [Band.Planting]: { model: 'shrub', height: 1, colour: DEEP_GREEN },
  [Band.Canopy]: { model: 'treeRound', height: 6, colour: GREEN, accent: BARK, trunk: 0.35 },
  [Band.Overlay]: { model: 'decal', height: 0.02 },
}

/**
 * A custom import has no recipe, so it renders as its own plan artwork laid
 * flat on the ground. That is honest — it shows exactly what is known about
 * the object — and avoids inventing a shape the user never asked for.
 */
const CUSTOM_FALLBACK: Profile = { model: 'decal', height: 0.02 }

export function profileFor(asset: AssetDef | undefined): Profile {
  if (!asset) return CUSTOM_FALLBACK
  const exact = PROFILES[asset.id]
  if (exact) return exact
  if (asset.source === 'custom') return CUSTOM_FALLBACK
  return CATEGORY_FALLBACK[asset.category] ?? BAND_FALLBACK[asset.band] ?? CUSTOM_FALLBACK
}

/** Material colours for the ground materials, used when a texture is absent. */
export const MATERIAL_FALLBACK_COLOUR = 0xb9c2b4
