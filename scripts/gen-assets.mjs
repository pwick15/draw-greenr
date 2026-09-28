#!/usr/bin/env node
/**
 * Generates the built-in asset library.
 *
 * Everything ships as SVG: crisp at any zoom, a few KB each, and editable if a
 * variant is wanted later. Run with `npm run gen:assets`.
 *
 * Output:
 *   public/assets/items/*.svg
 *   public/assets/materials/*.svg
 *   src/assets/builtin.ts        (typed catalog, generated — do not hand-edit)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as mat from './lib/materials.mjs'
import * as obj from './lib/objects.mjs'
import * as plant from './lib/plants.mjs'
import { PPM } from './lib/svg.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ITEM_DIR = resolve(ROOT, 'public/assets/items')
const MAT_DIR = resolve(ROOT, 'public/assets/materials')

const P = plant.PALETTES
const BLOOM = {
  pink: { h: 338, s: 64, l: 74 },
  white: { h: 44, s: 40, l: 94 },
  red: { h: 356, s: 68, l: 54 },
  purple: { h: 276, s: 46, l: 58 },
  blue: { h: 214, s: 58, l: 64 },
  yellow: { h: 48, s: 84, l: 62 },
  orange: { h: 24, s: 78, l: 58 },
}

const CATEGORIES = [
  { id: 'trees', name: 'Trees', icon: 'tree' },
  { id: 'shrubs', name: 'Shrubs & grasses', icon: 'shrub' },
  { id: 'beds', name: 'Beds & borders', icon: 'flower' },
  { id: 'structures', name: 'Houses & structures', icon: 'home' },
  { id: 'boundaries', name: 'Fences & walls', icon: 'fence' },
  { id: 'furniture', name: 'Furniture & leisure', icon: 'chair' },
  { id: 'water', name: 'Ponds & pools', icon: 'waves' },
  { id: 'ground', name: 'Ground details', icon: 'circle-dot' },
]

/**
 * `size` is the real-world footprint in metres; the SVG canvas is that size
 * multiplied by PPM, so artwork aspect always matches the footprint exactly.
 */
const ITEMS = [
  // --- Trees ------------------------------------------------------------
  t('oak', 'Oak', [8, 8], () => plant.deciduousTree({ seed: 'oak', size: 8 * PPM, palette: P.deciduous })),
  t('maple', 'Maple', [6, 6], () => plant.deciduousTree({ seed: 'maple', size: 6 * PPM, palette: { h: 96, s: 50, l: 40 } })),
  t('birch', 'Birch', [4.5, 4.5], () => plant.deciduousTree({ seed: 'birch', size: 4.5 * PPM, palette: P.lightGreen })),
  t('lime', 'Lime', [7, 7], () => plant.deciduousTree({ seed: 'lime', size: 7 * PPM, palette: { h: 84, s: 46, l: 44 } })),
  t('cherry', 'Cherry blossom', [5, 5], () => plant.deciduousTree({ seed: 'cherry', size: 5 * PPM, palette: { h: 110, s: 34, l: 46 }, blossom: BLOOM.pink })),
  t('apple', 'Apple tree', [4, 4], () => plant.deciduousTree({ seed: 'apple', size: 4 * PPM, palette: { h: 100, s: 42, l: 40 }, blossom: BLOOM.red })),
  t('magnolia', 'Magnolia', [4.5, 4.5], () => plant.deciduousTree({ seed: 'magnolia', size: 4.5 * PPM, palette: { h: 118, s: 34, l: 38 }, blossom: BLOOM.white })),
  t('japanese-maple', 'Japanese maple', [3.5, 3.5], () => plant.deciduousTree({ seed: 'jmaple', size: 3.5 * PPM, palette: P.purple })),
  t('olive', 'Olive tree', [4, 4], () => plant.deciduousTree({ seed: 'olive', size: 4 * PPM, palette: P.silver })),
  t('autumn-tree', 'Autumn tree', [5.5, 5.5], () => plant.deciduousTree({ seed: 'autumn', size: 5.5 * PPM, palette: P.autumn })),
  t('pine', 'Pine', [5, 5], () => plant.coniferTree({ seed: 'pine', size: 5 * PPM, palette: P.conifer, tiers: 4 })),
  t('spruce', 'Spruce', [4, 4], () => plant.coniferTree({ seed: 'spruce', size: 4 * PPM, palette: { h: 160, s: 32, l: 22 }, tiers: 5 })),
  t('cypress', 'Cypress', [1.2, 1.2], () => plant.coniferTree({ seed: 'cypress', size: 1.2 * PPM * 4, palette: { h: 150, s: 30, l: 24 }, tiers: 3 })),
  t('palm', 'Palm', [4.5, 4.5], () => plant.palmTree({ seed: 'palm', size: 4.5 * PPM, fronds: 11 })),
  t('tree-fern', 'Tree fern', [2.5, 2.5], () => plant.palmTree({ seed: 'tfern', size: 2.5 * PPM * 2, palette: { h: 142, s: 40, l: 28 }, fronds: 9 })),

  // --- Shrubs & grasses -------------------------------------------------
  s('boxwood-ball', 'Boxwood ball', [1, 1], () => plant.shrub({ seed: 'box', size: 1 * PPM * 3, palette: P.darkGreen })),
  s('boxwood-large', 'Boxwood, large', [1.8, 1.8], () => plant.shrub({ seed: 'box2', size: 1.8 * PPM * 2, palette: { h: 138, s: 34, l: 30 } })),
  s('lavender', 'Lavender', [0.8, 0.8], () => plant.shrub({ seed: 'lav', size: 0.8 * PPM * 4, palette: P.silver, flowers: BLOOM.purple })),
  s('hydrangea', 'Hydrangea', [1.4, 1.4], () => plant.shrub({ seed: 'hyd', size: 1.4 * PPM * 2.5, palette: P.lightGreen, flowers: BLOOM.blue })),
  s('rose-bush', 'Rose bush', [1.2, 1.2], () => plant.shrub({ seed: 'rose', size: 1.2 * PPM * 3, palette: { h: 122, s: 38, l: 34 }, flowers: BLOOM.red })),
  s('rhododendron', 'Rhododendron', [1.8, 1.8], () => plant.shrub({ seed: 'rhodo', size: 1.8 * PPM * 2, palette: P.darkGreen, flowers: BLOOM.pink })),
  s('viburnum', 'Viburnum', [1.6, 1.6], () => plant.shrub({ seed: 'vib', size: 1.6 * PPM * 2, palette: { h: 108, s: 40, l: 38 }, flowers: BLOOM.white })),
  s('ornamental-grass', 'Ornamental grass', [1, 1], () => plant.grassTuft({ seed: 'grass', size: 1 * PPM * 3, palette: P.olive, blades: 70 })),
  s('pampas-grass', 'Pampas grass', [1.8, 1.8], () => plant.grassTuft({ seed: 'pampas', size: 1.8 * PPM * 2, palette: { h: 58, s: 34, l: 62 }, blades: 84 })),
  s('fern', 'Fern', [1.1, 1.1], () => plant.grassTuft({ seed: 'fern', size: 1.1 * PPM * 3, palette: { h: 134, s: 38, l: 30 }, blades: 34 })),
  s('hosta', 'Hosta', [0.9, 0.9], () => plant.grassTuft({ seed: 'hosta', size: 0.9 * PPM * 4, palette: { h: 96, s: 30, l: 44 }, blades: 22 })),
  s('hedge-2m', 'Hedge, 2 m', [2, 0.6], () => plant.hedge({ seed: 'hedge2', width: 2 * PPM, height: 0.6 * PPM })),
  s('hedge-4m', 'Hedge, 4 m', [4, 0.6], () => plant.hedge({ seed: 'hedge4', width: 4 * PPM, height: 0.6 * PPM })),
  s('hedge-tall', 'Hedge, tall', [4, 1], () => plant.hedge({ seed: 'hedget', width: 4 * PPM, height: 1 * PPM, palette: { h: 142, s: 36, l: 24 } })),
  s('climber-trellis', 'Climber on trellis', [2, 0.35], () => plant.climber({ seed: 'climb', width: 2 * PPM, height: 0.35 * PPM * 2 })),

  // --- Beds -------------------------------------------------------------
  b('flower-bed-round', 'Flower bed, round', [2, 2], () => plant.flowerBed({ seed: 'fbr', width: 2 * PPM, height: 2 * PPM, bloom: BLOOM.orange })),
  b('flower-bed-long', 'Flower border', [3, 1.2], () => plant.flowerBed({ seed: 'fbl', width: 3 * PPM, height: 1.2 * PPM, bloom: BLOOM.purple, count: 46 })),
  b('wildflower-drift', 'Wildflower drift', [2.5, 1.8], () => plant.flowerBed({ seed: 'wfd', width: 2.5 * PPM, height: 1.8 * PPM, bloom: BLOOM.yellow, count: 52 })),
  b('rose-bed', 'Rose bed', [2.2, 1.4], () => plant.flowerBed({ seed: 'rb', width: 2.2 * PPM, height: 1.4 * PPM, bloom: BLOOM.red, count: 34 })),
  b('veg-bed', 'Raised vegetable bed', [2.4, 1.2], () => plant.vegBed({ seed: 'veg', width: 2.4 * PPM, height: 1.2 * PPM, rows: 4 })),
  b('veg-bed-small', 'Raised bed, small', [1.2, 0.8], () => plant.vegBed({ seed: 'veg2', width: 1.2 * PPM * 2, height: 0.8 * PPM * 2, rows: 3 })),
  b('potted-plant', 'Potted plant', [0.5, 0.5], () => plant.pottedPlant({ seed: 'pot', size: 0.5 * PPM * 6 })),
  b('potted-tree', 'Potted tree', [0.9, 0.9], () => plant.pottedPlant({ seed: 'pot2', size: 0.9 * PPM * 4, potColor: { h: 30, s: 12, l: 52 }, palette: P.darkGreen })),

  // --- Structures -------------------------------------------------------
  st('house-red', 'House, red roof', [10, 8], () => obj.house({ seed: 'hr', width: 10 * PPM, height: 8 * PPM, roof: { h: 8, s: 52, l: 44 } })),
  st('house-grey', 'House, grey roof', [10, 8], () => obj.house({ seed: 'hg', width: 10 * PPM, height: 8 * PPM, roof: { h: 215, s: 8, l: 42 } })),
  st('house-green', 'House, green roof', [10, 8], () => obj.house({ seed: 'hgr', width: 10 * PPM, height: 8 * PPM, roof: { h: 88, s: 40, l: 46 }, ridge: 'hip' })),
  st('house-flat', 'House, flat roof', [9, 7], () => obj.house({ seed: 'hf', width: 9 * PPM, height: 7 * PPM, roof: { h: 210, s: 6, l: 52 }, ridge: 'flat' })),
  st('house-small', 'Cottage', [6, 5], () => obj.house({ seed: 'hs', width: 6 * PPM, height: 5 * PPM, roof: { h: 20, s: 44, l: 46 } })),
  st('garage', 'Garage', [6, 3.5], () => obj.house({ seed: 'gar', width: 6 * PPM, height: 3.5 * PPM, roof: { h: 212, s: 8, l: 48 }, skylight: false })),
  st('carport', 'Carport', [5.5, 3], () => obj.decking({ seed: 'cp', width: 5.5 * PPM, height: 3 * PPM, tone: { h: 34, s: 40, l: 54 }, plankMeters: 0.3 })),
  st('shed', 'Garden shed', [3, 2.4], () => obj.shed({ seed: 'shed', width: 3 * PPM, height: 2.4 * PPM })),
  st('greenhouse', 'Greenhouse', [4, 3], () => obj.shed({ seed: 'gh', width: 4 * PPM, height: 3 * PPM, glass: true })),
  st('deck', 'Raised deck', [5, 4], () => obj.decking({ seed: 'deck', width: 5 * PPM, height: 4 * PPM })),
  st('stairs-straight', 'Stairs', [1.5, 1.2], () => obj.stairs({ width: 1.5 * PPM * 2, height: 1.2 * PPM * 2, treads: 5 })),
  st('stairs-fan', 'Stairs, fanned', [2, 1.2], () => obj.stairs({ width: 2 * PPM * 2, height: 1.2 * PPM * 2, treads: 5, fan: true })),

  // --- Boundaries -------------------------------------------------------
  bd('fence-2m', 'Fence, 2 m', [2, 0.25], () => obj.fence({ seed: 'f2', width: 2 * PPM, height: 0.25 * PPM * 4, posts: 3 })),
  bd('fence-4m', 'Fence, 4 m', [4, 0.25], () => obj.fence({ seed: 'f4', width: 4 * PPM, height: 0.25 * PPM * 4, posts: 5 })),
  bd('wall-2m', 'Wall, 2 m', [2, 0.4], () => obj.wallRun({ seed: 'w2', width: 2 * PPM, height: 0.4 * PPM * 3 })),
  bd('wall-4m', 'Wall, 4 m', [4, 0.4], () => obj.wallRun({ seed: 'w4', width: 4 * PPM, height: 0.4 * PPM * 3 })),

  // --- Furniture --------------------------------------------------------
  f('dining-set-6', 'Dining set, 6', [2.6, 2], () => obj.diningSet({ seed: 'd6', width: 2.6 * PPM, height: 2 * PPM, seats: 6 })),
  f('dining-set-round', 'Dining set, round', [2.4, 2.4], () => obj.diningSet({ seed: 'dr', width: 2.4 * PPM, height: 2.4 * PPM, shape: 'round', seats: 6 })),
  f('bistro-set', 'Bistro set', [1.4, 1.4], () => obj.diningSet({ seed: 'bs', width: 1.4 * PPM * 2, height: 1.4 * PPM * 2, shape: 'round', seats: 2, tone: { h: 210, s: 6, l: 46 } })),
  f('bench', 'Bench', [1.8, 0.6], () => obj.bench({ width: 1.8 * PPM, height: 0.6 * PPM * 2 })),
  f('lounger', 'Sun lounger', [2, 0.7], () => obj.lounger({ width: 0.7 * PPM * 2, height: 2 * PPM })),
  f('parasol', 'Parasol', [3, 3], () => obj.parasol({ size: 3 * PPM })),
  f('grill', 'Barbecue', [1.2, 0.7], () => obj.grill({ width: 1.2 * PPM * 2, height: 0.7 * PPM * 2 })),
  f('firepit', 'Fire pit', [1, 1], () => obj.firepit({ size: 1 * PPM * 3 })),
  f('trampoline', 'Trampoline', [3.5, 3.5], () => obj.trampoline({ size: 3.5 * PPM })),
  f('sandbox', 'Sandpit', [1.5, 1.5], () => obj.sandbox({ seed: 'sb', width: 1.5 * PPM * 2, height: 1.5 * PPM * 2 })),
  f('playhouse', 'Playhouse', [2, 1.8], () => obj.playhouse({ width: 2 * PPM * 2, height: 1.8 * PPM * 2 })),
  f('car', 'Car', [4.5, 1.9], () => obj.car({ width: 1.9 * PPM * 2, height: 4.5 * PPM })),
  f('compost', 'Compost bin', [1, 1], () => obj.compost({ size: 1 * PPM * 3 })),

  // --- Water ------------------------------------------------------------
  w('pond-natural', 'Pond, natural', [4, 3], () => obj.pond({ seed: 'pn', width: 4 * PPM, height: 3 * PPM })),
  w('pond-small', 'Pond, small', [2, 1.6], () => obj.pond({ seed: 'ps', width: 2 * PPM * 2, height: 1.6 * PPM * 2 })),
  w('pool-rect', 'Swimming pool', [8, 4], () => obj.pool({ width: 8 * PPM, height: 4 * PPM })),
  w('pool-round', 'Pool, round', [4, 4], () => obj.pool({ width: 4 * PPM, height: 4 * PPM, round: true })),
  w('birdbath', 'Bird bath', [0.6, 0.6], () => obj.birdbath({ size: 0.6 * PPM * 6 })),

  // --- Ground details ---------------------------------------------------
  gd('stepping-stones', 'Stepping stones', [3, 0.6], () => obj.steppingStones({ seed: 'ss', width: 3 * PPM, height: 0.6 * PPM * 2, count: 5 })),
]

const MATERIALS = [
  m('lawn', 'Lawn', '#7cb342', 2, () => mat.lawn({ size: 256 })),
  m('meadow', 'Meadow', '#9ccc65', 2.5, () => mat.lawn({ size: 256, seed: 'meadow', base: { h: 78, s: 44, l: 54 } })),
  m('earth', 'Earth / bed', '#5d4633', 2, () => mat.earth({ size: 256 })),
  m('bark', 'Bark mulch', '#4a3524', 1.5, () => mat.bark({ size: 256 })),
  m('paving', 'Paving', '#b4aca3', 2, () => mat.paving({ size: 256 })),
  m('cobbles', 'Cobblestones', '#93908c', 1.4, () => mat.cobbles({ size: 256 })),
  m('gravel', 'Gravel', '#a89e91', 1, () => mat.gravel({ size: 256 })),
  m('decking', 'Decking', '#c39a68', 1.2, () => mat.decking({ size: 256 })),
  m('stone-wall', 'Wall', '#8d9299', 1.2, () => mat.wall({ size: 256 })),
  m('sand', 'Sand', '#e3cf9a', 1.5, () => mat.sand({ size: 256 })),
  m('water', 'Water', '#4fb3d9', 3, () => mat.water({ size: 256 }), false),
]

// --- helpers ---------------------------------------------------------------

function item(category, band, aspectLocked, id, name, size, render, tags = []) {
  return { id, name, category, band, size, render, aspectLocked, tags }
}
function t(id, name, size, render) { return item('trees', 'Canopy', true, id, name, size, render, ['tree']) }
function s(id, name, size, render) { return item('shrubs', 'Planting', false, id, name, size, render, ['shrub']) }
function b(id, name, size, render) { return item('beds', 'Planting', false, id, name, size, render, ['bed']) }
function st(id, name, size, render) { return item('structures', 'Structure', false, id, name, size, render, ['building']) }
function bd(id, name, size, render) { return item('boundaries', 'Structure', false, id, name, size, render, ['boundary']) }
function f(id, name, size, render) { return item('furniture', 'Furniture', false, id, name, size, render, ['furniture']) }
function w(id, name, size, render) { return item('water', 'Water', false, id, name, size, render, ['water']) }
function gd(id, name, size, render) { return item('ground', 'Ground', false, id, name, size, render, ['ground']) }
function m(id, name, fill, textureScale, render, occludes = true) {
  return { id, name, fill, textureScale, render, occludes }
}

// --- emit ------------------------------------------------------------------

rmSync(ITEM_DIR, { recursive: true, force: true })
rmSync(MAT_DIR, { recursive: true, force: true })
mkdirSync(ITEM_DIR, { recursive: true })
mkdirSync(MAT_DIR, { recursive: true })

let bytes = 0
const seen = new Set()
for (const it of ITEMS) {
  if (seen.has(it.id)) throw new Error(`duplicate asset id: ${it.id}`)
  seen.add(it.id)
  const svg = it.render()
  writeFileSync(resolve(ITEM_DIR, `${it.id}.svg`), svg)
  bytes += svg.length
}
for (const mt of MATERIALS) {
  const svg = mt.render()
  writeFileSync(resolve(MAT_DIR, `${mt.id}.svg`), svg)
  bytes += svg.length
}

const ts = `// Generated by scripts/gen-assets.mjs — do not edit by hand.
// Run \`npm run gen:assets\` to regenerate.
import type { AssetCategory, AssetDef, MaterialDef } from '@/core/types'
import { Band } from '@/core/types'

export const BUILTIN_CATEGORIES: AssetCategory[] = ${JSON.stringify(CATEGORIES, null, 2)}

export const BUILTIN_ASSETS: AssetDef[] = [
${ITEMS.map(
  (it) => `  {
    id: '${it.id}',
    name: ${JSON.stringify(it.name)},
    category: '${it.category}',
    band: Band.${it.band},
    source: 'builtin',
    src: '/assets/items/${it.id}.svg',
    defaultSize: { w: ${it.size[0]}, h: ${it.size[1]} },
    aspectLocked: ${it.aspectLocked},
    tags: ${JSON.stringify(it.tags)},
  },`,
).join('\n')}
]

export const BUILTIN_MATERIALS: MaterialDef[] = [
${MATERIALS.map(
  (mt) => `  {
    id: '${mt.id}',
    name: ${JSON.stringify(mt.name)},
    source: 'builtin',
    fill: '${mt.fill}',
    textureSrc: '/assets/materials/${mt.id}.svg',
    textureScale: ${mt.textureScale},
    occludes: ${mt.occludes},
  },`,
).join('\n')}
]
`

writeFileSync(resolve(ROOT, 'src/assets/builtin.ts'), ts)

console.log(
  `generated ${ITEMS.length} items + ${MATERIALS.length} materials (${(bytes / 1024).toFixed(0)} KB of SVG)`,
)
