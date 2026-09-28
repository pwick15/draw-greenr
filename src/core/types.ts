/**
 * Core domain types.
 *
 * World coordinates are **metres**, y pointing down (screen-like) so that the
 * world -> screen transform is a pure scale + translate with no axis flip.
 */

export type Vec2 = { x: number; y: number }

/** Axis-aligned rectangle in world space. */
export type Rect = { x: number; y: number; w: number; h: number }

// ---------------------------------------------------------------------------
// Polygon geometry (matches the shape polyclip-ts expects and returns)
// ---------------------------------------------------------------------------

export type Pair = [number, number]
/** A closed ring. First and last point need not be duplicated. */
export type Ring = Pair[]
/** `[outerRing, ...holeRings]` */
export type Poly = Ring[]
export type MultiPoly = Poly[]

// ---------------------------------------------------------------------------
// Layer bands
// ---------------------------------------------------------------------------

/**
 * Objects are stacked by *semantic band* first, manual order second. This is
 * the thing that stops z-ordering becoming a chore once a plan has a hundred
 * objects in it: a deck chair can never end up above a tree canopy, no matter
 * what order the two were dropped in, so the only ordering you ever adjust by
 * hand is between siblings that genuinely compete.
 *
 * Selection never changes any of this. Clicking is a read-only operation.
 */
export const Band = {
  /** Plot surfaces: lawn, earth, paving, gravel. Always the substrate. */
  Terrain: 0,
  /** Things lying flat on the substrate: stepping stones, edging, markings. */
  Ground: 1,
  /** Ponds and pools — above the substrate, below anything built. */
  Water: 2,
  /** Built form: houses, sheds, walls, fences, decking, stairs. */
  Structure: 3,
  /** Movable things: furniture, grills, pots, play equipment, vehicles. */
  Furniture: 4,
  /** Low planting: shrubs, flowers, beds, grasses, vegetables. */
  Planting: 5,
  /** Tree canopies — they overhang everything below them. */
  Canopy: 6,
  /** Annotations: notes, dimensions, labels. Never occluded. */
  Overlay: 7,
} as const

export type BandId = (typeof Band)[keyof typeof Band]

export const BAND_ORDER: BandId[] = [
  Band.Terrain,
  Band.Ground,
  Band.Water,
  Band.Structure,
  Band.Furniture,
  Band.Planting,
  Band.Canopy,
  Band.Overlay,
]

export const BAND_META: Record<BandId, { name: string; hint: string }> = {
  [Band.Terrain]: { name: 'Terrain', hint: 'Lawn, paving and other ground cover' },
  [Band.Ground]: { name: 'Ground', hint: 'Flat items resting on the ground' },
  [Band.Water]: { name: 'Water', hint: 'Ponds and pools' },
  [Band.Structure]: { name: 'Structures', hint: 'Buildings, walls, fences, decking' },
  [Band.Furniture]: { name: 'Furniture', hint: 'Movable items and equipment' },
  [Band.Planting]: { name: 'Planting', hint: 'Shrubs, beds and flowers' },
  [Band.Canopy]: { name: 'Canopy', hint: 'Tree crowns, which overhang everything' },
  [Band.Overlay]: { name: 'Annotations', hint: 'Notes, labels and dimensions' },
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export type AssetSource = 'builtin' | 'custom'

export interface AssetDef {
  id: string
  name: string
  /** Catalog grouping, e.g. `trees`. Purely for browsing. */
  category: string
  /** Default stacking band for objects created from this asset. */
  band: BandId
  source: AssetSource
  /** Image URL (built-ins) or object URL resolved from IndexedDB (custom). */
  src: string
  /** Natural size in metres when first placed. */
  defaultSize: { w: number; h: number }
  /** Whether resizing should preserve the aspect ratio by default. */
  aspectLocked: boolean
  tags: string[]
  /** Author-supplied note, shown in the inspector. */
  note?: string
}

export interface AssetCategory {
  id: string
  name: string
  /** Lucide-ish icon key resolved by the UI. */
  icon: string
}

// ---------------------------------------------------------------------------
// Materials (plot surfaces)
// ---------------------------------------------------------------------------

export interface MaterialDef {
  id: string
  name: string
  source: AssetSource
  /** Flat colour, used as the fallback and as the swatch tint. */
  fill: string
  /** Tileable texture URL. Optional — flat fill is a valid material. */
  textureSrc?: string
  /** Width in metres that one texture tile covers. */
  textureScale: number
  stroke?: string
  /** Stroke width in metres. */
  strokeWidth?: number
  /**
   * Whether painting this material carves itself out of every other material.
   * True for real ground cover (you cannot have lawn and paving in the same
   * square metre); false for decorative overlays that may sit on top.
   */
  occludes: boolean
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface GardenObject {
  id: string
  assetId: string
  /** Centre of the object, in metres. Rotation pivots here. */
  x: number
  y: number
  /** Footprint in metres, before rotation. */
  w: number
  h: number
  /** Degrees, clockwise. */
  rotation: number
  flipX: boolean
  flipY: boolean
  band: BandId
  /** Manual stacking position within the band. Higher draws later. */
  order: number
  opacity: number
  locked: boolean
  hidden: boolean
  /** Overrides the asset name in the layers panel. */
  label?: string
}

export interface Surface {
  id: string
  materialId: string
  geometry: MultiPoly
  /** Manual stacking position among surfaces. Higher draws later. */
  order: number
  opacity: number
  locked: boolean
  hidden: boolean
}

export interface DocSettings {
  /** Grid spacing in metres. */
  gridSize: number
  snapToGrid: boolean
  /** Snap tolerance in screen pixels. */
  snapTolerance: number
  showGrid: boolean
  /** Background beyond any painted surface. */
  backgroundColor: string
}

export interface GardenDoc {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objects: Record<string, GardenObject>
  /** Ordered low-to-high. One entry per material actually used. */
  surfaces: Surface[]
  settings: DocSettings
}

export const DEFAULT_SETTINGS: DocSettings = {
  gridSize: 1,
  snapToGrid: false,
  snapTolerance: 10,
  showGrid: true,
  backgroundColor: '#eef1ec',
}

// ---------------------------------------------------------------------------
// Selection targets
// ---------------------------------------------------------------------------

export type SelectionRef =
  | { kind: 'object'; id: string }
  | { kind: 'surface'; id: string }

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

export interface Viewport {
  /** World coordinate displayed at screen (0, 0). */
  ox: number
  oy: number
  /** Pixels per metre. */
  scale: number
}
