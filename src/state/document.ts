import { produce } from 'immer'
import { create } from 'zustand'

import { objectBounds, unionRects } from '@/core/geometry'
import { objectZ } from '@/core/picking'
import type {
  AssetDef,
  BandId,
  GardenDoc,
  GardenObject,
  MultiPoly,
  Rect,
  Surface,
  Vec2,
} from '@/core/types'
import { Band, DEFAULT_SETTINGS } from '@/core/types'

export const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function createEmptyDoc(name = 'Untitled garden'): GardenDoc {
  const now = Date.now()
  return {
    id: newId('doc'),
    name,
    createdAt: now,
    updatedAt: now,
    objects: {},
    surfaces: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

interface HistoryEntry {
  label: string
  before: GardenDoc
  after: GardenDoc
}

const HISTORY_LIMIT = 250

/**
 * History stores whole-document snapshots rather than patches. Immer gives
 * structural sharing, so an entry that moved one object shares every untouched
 * object with its neighbours — a few pointers, not a copy of the plan.
 */
interface DocStore {
  doc: GardenDoc
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Document as it was when the open transaction began. */
  txnBase: GardenDoc | null
  txnLabel: string

  /** One recipe, one undo step. */
  apply: (label: string, recipe: (draft: GardenDoc) => void) => void
  /** Open a multi-step edit (a drag, a resize) that collapses to one undo step. */
  begin: (label: string) => void
  /** Edit inside an open transaction. Does not touch history on its own. */
  update: (recipe: (draft: GardenDoc) => void) => void
  end: () => void
  /** Abandon an open transaction and restore the pre-transaction document. */
  cancel: () => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  replaceDoc: (doc: GardenDoc, label?: string) => void
  resetDoc: (doc?: GardenDoc) => void
}

export const useDocStore = create<DocStore>()((set, get) => ({
  doc: createEmptyDoc(),
  past: [],
  future: [],
  txnBase: null,
  txnLabel: '',

  apply(label, recipe) {
    const { doc, past, txnBase } = get()
    const next = produce(doc, (draft) => {
      recipe(draft)
      draft.updatedAt = Date.now()
    })
    if (next === doc) return
    // Inside a transaction, defer the history entry to `end()`.
    if (txnBase) {
      set({ doc: next })
      return
    }
    set({
      doc: next,
      past: [...past, { label, before: doc, after: next }].slice(-HISTORY_LIMIT),
      future: [],
    })
  },

  begin(label) {
    if (get().txnBase) return
    set({ txnBase: get().doc, txnLabel: label })
  },

  update(recipe) {
    const { doc } = get()
    const next = produce(doc, (draft) => {
      recipe(draft)
      draft.updatedAt = Date.now()
    })
    if (next !== doc) set({ doc: next })
  },

  end() {
    const { txnBase, txnLabel, doc, past } = get()
    if (!txnBase) return
    if (txnBase === doc) {
      set({ txnBase: null, txnLabel: '' })
      return
    }
    set({
      txnBase: null,
      txnLabel: '',
      past: [...past, { label: txnLabel, before: txnBase, after: doc }].slice(-HISTORY_LIMIT),
      future: [],
    })
  },

  cancel() {
    const { txnBase } = get()
    if (!txnBase) return
    set({ doc: txnBase, txnBase: null, txnLabel: '' })
  },

  undo() {
    const { past, future, doc, txnBase } = get()
    if (txnBase || past.length === 0) return
    const entry = past[past.length - 1]
    set({ doc: entry.before, past: past.slice(0, -1), future: [...future, { ...entry, after: doc }] })
  },

  redo() {
    const { past, future } = get()
    if (future.length === 0) return
    const entry = future[future.length - 1]
    set({ doc: entry.after, future: future.slice(0, -1), past: [...past, entry] })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  replaceDoc(doc, label = 'Replace document') {
    const prev = get().doc
    set({
      doc,
      past: [...get().past, { label, before: prev, after: doc }].slice(-HISTORY_LIMIT),
      future: [],
      txnBase: null,
    })
  },

  resetDoc(doc) {
    set({ doc: doc ?? createEmptyDoc(), past: [], future: [], txnBase: null, txnLabel: '' })
  },
}))

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Next free stacking position at the top of a band. */
export function topOfBand(doc: GardenDoc, band: BandId): number {
  let max = -1
  for (const o of Object.values(doc.objects)) {
    if (o.band === band && o.order > max) max = o.order
  }
  return max + 1
}

export function bottomOfBand(doc: GardenDoc, band: BandId): number {
  let min = 1
  for (const o of Object.values(doc.objects)) {
    if (o.band === band && o.order < min) min = o.order
  }
  return min - 1
}

export function makeObject(asset: AssetDef, at: Vec2, overrides: Partial<GardenObject> = {}): GardenObject {
  return {
    id: newId('obj'),
    assetId: asset.id,
    x: at.x,
    y: at.y,
    w: asset.defaultSize.w,
    h: asset.defaultSize.h,
    rotation: 0,
    flipX: false,
    flipY: false,
    band: asset.band,
    order: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    ...overrides,
  }
}

/** Objects in draw order: band first, manual position second. */
export function sortedObjects(doc: GardenDoc): GardenObject[] {
  return Object.values(doc.objects).sort((a, b) => objectZ(a) - objectZ(b))
}

export function objectsInBand(doc: GardenDoc, band: BandId): GardenObject[] {
  return Object.values(doc.objects)
    .filter((o) => o.band === band)
    .sort((a, b) => a.order - b.order)
}

export function documentBounds(doc: GardenDoc): Rect | null {
  const rects: Rect[] = []
  for (const o of Object.values(doc.objects)) if (!o.hidden) rects.push(objectBounds(o))
  for (const s of doc.surfaces) {
    if (s.hidden) continue
    for (const poly of s.geometry) {
      if (!poly[0]?.length) continue
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of poly[0]) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      rects.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
    }
  }
  return unionRects(rects)
}

// ---------------------------------------------------------------------------
// Reordering
// ---------------------------------------------------------------------------

export type ReorderMove = 'front' | 'back' | 'forward' | 'backward'

/**
 * Reordering is **confined to the object's own band**. Raising a chair can
 * never lift it above a tree canopy, so "bring to front" stops being the
 * blunt instrument it is in a flat z-list and becomes a local adjustment
 * between things that actually compete for the same space.
 */
export function reorderObjects(doc: GardenDoc, ids: string[], move: ReorderMove): void {
  const byBand = new Map<BandId, string[]>()
  for (const id of ids) {
    const o = doc.objects[id]
    if (!o) continue
    const list = byBand.get(o.band) ?? []
    list.push(id)
    byBand.set(o.band, list)
  }

  for (const [band, bandIds] of byBand) {
    const siblings = Object.values(doc.objects)
      .filter((o) => o.band === band)
      .sort((a, b) => a.order - b.order)
    const moving = new Set(bandIds)

    let next: GardenObject[]
    if (move === 'front') {
      next = [...siblings.filter((o) => !moving.has(o.id)), ...siblings.filter((o) => moving.has(o.id))]
    } else if (move === 'back') {
      next = [...siblings.filter((o) => moving.has(o.id)), ...siblings.filter((o) => !moving.has(o.id))]
    } else {
      next = siblings.slice()
      const delta = move === 'forward' ? 1 : -1
      // Walk from the leading edge so a multi-selection keeps its internal order.
      const indices = next
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => moving.has(o.id))
        .map(({ i }) => i)
      if (delta > 0) indices.reverse()
      for (const i of indices) {
        const j = i + delta
        if (j < 0 || j >= next.length) continue
        if (moving.has(next[j].id)) continue
        ;[next[i], next[j]] = [next[j], next[i]]
      }
    }
    next.forEach((o, i) => {
      doc.objects[o.id].order = i
    })
  }
}

export function setBand(doc: GardenDoc, ids: string[], band: BandId): void {
  let order = topOfBand(doc, band)
  for (const id of ids) {
    const o = doc.objects[id]
    if (!o || o.band === band) continue
    o.band = band
    o.order = order++
  }
}

export function reorderSurfaces(doc: GardenDoc, id: string, move: ReorderMove): void {
  const list = doc.surfaces.slice().sort((a, b) => a.order - b.order)
  const index = list.findIndex((s) => s.id === id)
  if (index < 0) return
  let target = index
  if (move === 'front') target = list.length - 1
  else if (move === 'back') target = 0
  else target = Math.max(0, Math.min(list.length - 1, index + (move === 'forward' ? 1 : -1)))
  if (target === index) return
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
  list.forEach((s, i) => {
    const found = doc.surfaces.find((x) => x.id === s.id)
    if (found) found.order = i
  })
  doc.surfaces.sort((a, b) => a.order - b.order)
}

export function setSurfaceGeometry(doc: GardenDoc, id: string, geometry: MultiPoly): void {
  const surface = doc.surfaces.find((s) => s.id === id)
  if (!surface) return
  if (geometry.length === 0) doc.surfaces = doc.surfaces.filter((s) => s.id !== id)
  else surface.geometry = geometry
}

export function replaceSurfaces(doc: GardenDoc, surfaces: Surface[]): void {
  doc.surfaces = surfaces
}

export const ALL_BANDS: BandId[] = [
  Band.Terrain,
  Band.Ground,
  Band.Water,
  Band.Structure,
  Band.Furniture,
  Band.Planting,
  Band.Canopy,
  Band.Overlay,
]
