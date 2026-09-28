import { objectBounds, unionRects } from '@/core/geometry'
import { eraseFromAll } from '@/core/surfaces'
import type { BandId, GardenObject, Rect, SelectionRef, Vec2 } from '@/core/types'
import { fitRect } from '@/core/viewport'

import { getAsset, getMaterials } from './assets'
import {
  documentBounds,
  newId,
  reorderObjects,
  reorderSurfaces,
  setBand,
  topOfBand,
  useDocStore,
  type ReorderMove,
} from './document'
import { useEditorStore } from './editor'

const doc = () => useDocStore.getState()
const editor = () => useEditorStore.getState()

const selectedObjectIds = (): string[] => {
  const { objects } = doc().doc
  return editor()
    .selection.filter((r) => r.kind === 'object')
    .map((r) => r.id)
    .filter((id) => objects[id] && !objects[id].locked)
}

const selectedSurfaceIds = (): string[] =>
  editor()
    .selection.filter((r) => r.kind === 'surface')
    .map((r) => r.id)

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export function deleteSelection(): void {
  const objectIds = selectedObjectIds()
  const surfaceIds = selectedSurfaceIds()
  if (objectIds.length === 0 && surfaceIds.length === 0) return
  doc().apply('Delete', (draft) => {
    for (const id of objectIds) delete draft.objects[id]
    if (surfaceIds.length) draft.surfaces = draft.surfaces.filter((s) => !surfaceIds.includes(s.id))
  })
  editor().clearSelection()
}

/** Offset a duplicate by a visible but small amount: a quarter of a metre. */
const DUPLICATE_OFFSET = 0.25

export function duplicateSelection(): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  const created: SelectionRef[] = []
  doc().apply('Duplicate', (draft) => {
    for (const id of ids) {
      const source = draft.objects[id]
      if (!source) continue
      const copy: GardenObject = {
        ...source,
        id: newId('obj'),
        x: source.x + DUPLICATE_OFFSET,
        y: source.y + DUPLICATE_OFFSET,
        order: topOfBand(draft, source.band),
      }
      draft.objects[copy.id] = copy
      created.push({ kind: 'object', id: copy.id })
    }
  })
  if (created.length) editor().select(created)
}

export function nudgeSelection(dx: number, dy: number): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  doc().apply('Nudge', (draft) => {
    for (const id of ids) {
      const object = draft.objects[id]
      if (!object) continue
      object.x += dx
      object.y += dy
    }
  })
}

export function rotateSelection(degrees: number): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  doc().apply('Rotate', (draft) => {
    for (const id of ids) {
      const object = draft.objects[id]
      if (object) object.rotation += degrees
    }
  })
}

export function flipSelection(axis: 'x' | 'y'): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  doc().apply(axis === 'x' ? 'Flip horizontally' : 'Flip vertically', (draft) => {
    for (const id of ids) {
      const object = draft.objects[id]
      if (!object) continue
      if (axis === 'x') object.flipX = !object.flipX
      else object.flipY = !object.flipY
    }
  })
}

export function setSelectionLocked(locked: boolean): void {
  const ids = editor()
    .selection.filter((r) => r.kind === 'object')
    .map((r) => r.id)
  const surfaceIds = selectedSurfaceIds()
  if (ids.length === 0 && surfaceIds.length === 0) return
  doc().apply(locked ? 'Lock' : 'Unlock', (draft) => {
    for (const id of ids) if (draft.objects[id]) draft.objects[id].locked = locked
    for (const id of surfaceIds) {
      const surface = draft.surfaces.find((s) => s.id === id)
      if (surface) surface.locked = locked
    }
  })
}

export function updateSelectedObjects(label: string, patch: (object: GardenObject) => void): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  doc().apply(label, (draft) => {
    for (const id of ids) {
      const object = draft.objects[id]
      if (object) patch(object)
    }
  })
}

// ---------------------------------------------------------------------------
// Stacking
// ---------------------------------------------------------------------------

export function reorderSelection(move: ReorderMove): void {
  const objectIds = selectedObjectIds()
  const surfaceIds = selectedSurfaceIds()
  if (objectIds.length === 0 && surfaceIds.length === 0) return
  const label = {
    front: 'Bring to front',
    back: 'Send to back',
    forward: 'Bring forward',
    backward: 'Send backward',
  }[move]
  doc().apply(label, (draft) => {
    if (objectIds.length) reorderObjects(draft, objectIds, move)
    for (const id of surfaceIds) reorderSurfaces(draft, id, move)
  })
}

export function moveSelectionToBand(band: BandId): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  doc().apply('Change layer', (draft) => setBand(draft, ids, band))
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function selectAll(): void {
  const state = editor()
  const refs: SelectionRef[] = Object.values(doc().doc.objects)
    .filter((o) => !o.locked && !o.hidden && !state.hiddenBands.includes(o.band))
    .filter((o) => state.isolatedBand === null || o.band === state.isolatedBand)
    .map((o) => ({ kind: 'object', id: o.id }))
  editor().select(refs)
}

/** Select every object sharing the clicked object's asset. */
export function selectSameAsset(): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  const assetIds = new Set(ids.map((id) => doc().doc.objects[id]?.assetId))
  editor().select(
    Object.values(doc().doc.objects)
      .filter((o) => assetIds.has(o.assetId) && !o.locked && !o.hidden)
      .map((o) => ({ kind: 'object', id: o.id })),
  )
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function eraseSurfaceUnderSelection(): void {
  const ids = selectedObjectIds()
  if (ids.length === 0) return
  const state = doc().doc

  // Compute on plain state; handing polyclip an immer draft would make it walk
  // a proxy per vertex.
  let surfaces = state.surfaces
  for (const id of ids) {
    const object = state.objects[id]
    if (!object) continue
    const b = objectBounds(object)
    surfaces = eraseFromAll(surfaces, [
      [
        [
          [b.x, b.y],
          [b.x + b.w, b.y],
          [b.x + b.w, b.y + b.h],
          [b.x, b.y + b.h],
        ],
      ],
    ])
  }

  doc().apply('Clear surface under selection', (draft) => {
    draft.surfaces = surfaces
  })
}

export function setSurfaceMaterial(surfaceId: string, materialId: string): void {
  const materials = getMaterials()
  if (!materials.has(materialId)) return
  doc().apply('Change material', (draft) => {
    const surface = draft.surfaces.find((s) => s.id === surfaceId)
    if (surface) surface.materialId = materialId
  })
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function zoomToFit(): void {
  const { stageSize, setViewport } = editor()
  const bounds = documentBounds(doc().doc)
  if (!bounds) {
    setViewport({ ox: -8, oy: -6, scale: 32 })
    return
  }
  setViewport(fitRect(bounds, stageSize.width, stageSize.height))
}

export function zoomToSelection(): void {
  const { stageSize, setViewport, selection } = editor()
  const rects: Rect[] = []
  for (const ref of selection) {
    if (ref.kind === 'object') {
      const object = doc().doc.objects[ref.id]
      if (object) rects.push(objectBounds(object))
    } else {
      const surface = doc().doc.surfaces.find((s) => s.id === ref.id)
      if (!surface) continue
      for (const poly of surface.geometry) {
        if (!poly[0]?.length) continue
        const xs = poly[0].map(([x]) => x)
        const ys = poly[0].map(([, y]) => y)
        rects.push({
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
        })
      }
    }
  }
  const bounds = unionRects(rects)
  if (!bounds) return zoomToFit()
  setViewport(fitRect(bounds, stageSize.width, stageSize.height, 0.25))
}

export function centreOnWorld(point: Vec2): void {
  const { stageSize, setViewport } = editor()
  setViewport((vp) => ({
    ...vp,
    ox: point.x - stageSize.width / 2 / vp.scale,
    oy: point.y - stageSize.height / 2 / vp.scale,
  }))
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/** Drop an asset in the middle of the current view. */
export function placeAssetAtCentre(assetId: string): void {
  const asset = getAsset(assetId)
  if (!asset) return
  const { viewport, stageSize, select } = editor()
  const centre = {
    x: viewport.ox + stageSize.width / 2 / viewport.scale,
    y: viewport.oy + stageSize.height / 2 / viewport.scale,
  }
  const id = newId('obj')
  doc().apply(`Place ${asset.name}`, (draft) => {
    draft.objects[id] = {
      id,
      assetId: asset.id,
      x: centre.x,
      y: centre.y,
      w: asset.defaultSize.w,
      h: asset.defaultSize.h,
      rotation: 0,
      flipX: false,
      flipY: false,
      band: asset.band,
      order: topOfBand(draft, asset.band),
      opacity: 1,
      locked: false,
      hidden: false,
    }
  })
  select([{ kind: 'object', id }])
}
