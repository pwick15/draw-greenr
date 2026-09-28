# Greenr

A top-down garden and landscape planner. Draw ground surfaces, place plants,
structures and furniture to scale in metres, and import your own artwork.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # core geometry, picking and transform maths
npm run gen:assets   # regenerate the built-in artwork
```

## Why it works the way it does

Three decisions shape most of the codebase.

### Stacking is semantic, not manual

Every object belongs to a **band** — Terrain, Ground, Water, Structure,
Furniture, Planting, Canopy, Annotations — and sorts by band first, manual
order second. Raising a deck chair can never lift it above a tree canopy, so
the only ordering ever adjusted by hand is between things that genuinely
compete for the same space. Flat z-lists stop being workable at about fifty
objects; this stays workable at a thousand.

**Selection never mutates the stack.** Clicking is strictly a read. Clicking
the same spot repeatedly walks *downward* through whatever is buried there and
wraps, with a "3 of 7 here" readout, so everything is reachable without
promoting anything. Alt-click goes one level deep immediately.

### Picking is ours, not Konva's

The content layer runs with `listening={false}`, which switches off Konva's hit
canvas entirely — no parallel colour-keyed bitmap per node. Instead
`core/picking` tests against a 96×96 alpha mask built once per *asset*
(`core/imageCache`), so a hundred oaks share one 9 KB mask. That buys
alpha-accurate clicks — the transparent corner of a tree crown is not
clickable — plus full control over depth cycling and band priority.

### Surfaces are a partition, not a stack

Ground materials are stored as one `MultiPolygon` per material, and painting an
occluding material carves its footprint out of every other one (`core/surfaces`,
via `polyclip-ts`). A hundred edits collapse into one shape per material: one
draw call, no z-fighting possible, and an honest m² readout because nothing is
hidden underneath anything else.

## Layout

```
src/
  core/        Pure logic, no React — geometry, picking, surfaces, transforms,
               snapping, viewport maths, image + alpha-mask cache
  state/       Zustand stores: document (+ undo), editor, assets, persistence
  canvas/      Konva rendering and the pointer-interaction hook
  ui/          Panels, toolbar, dialogs
  assets/      Generated catalog + custom-asset import pipeline
scripts/       SVG artwork generators (see below)
```

`core/` is deliberately React-free and is where the tests live — the subtle
parts (rotated resize, boolean ops, pick ordering) are all testable without a
browser.

## Artwork

The built-in library is **generated**, not drawn: `scripts/gen-assets.mjs`
emits every item and tileable ground texture as SVG, plus the typed catalog at
`src/assets/builtin.ts`. Regenerate with `npm run gen:assets`.

The generated SVGs are committed. They are what actually ships, they are small,
and having them in the tree means the app builds without running the generator.

`node scripts/contact-sheet.mjs out.svg` renders every asset onto one sheet,
which is the fastest way to eyeball the library after changing a generator.

Ground textures tile seamlessly: each scattered element is emitted up to four
times, wrapped across the tile edges.

## Storage

Local-first. Plans and custom assets live in IndexedDB (`state/db.ts`) and
autosave on a debounce. Plans export as `.greenr` JSON; custom assets export as
`.greenrpack` bundles with the artwork inlined as data URLs.
