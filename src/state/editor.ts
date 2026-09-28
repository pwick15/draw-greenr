import { create } from 'zustand'

import type { PickCycleState } from '@/core/picking'
import type { BandId, SelectionRef, Vec2, Viewport } from '@/core/types'
import type { PaintMode } from '@/core/surfaces'
import { DEFAULT_SCALE } from '@/core/viewport'

export type ToolId = 'select' | 'pan' | 'plot' | 'measure'

export interface MeasureState {
  from: Vec2
  to: Vec2
  done: boolean
}

interface EditorState {
  tool: ToolId
  /** The tool to return to once a transient pan (space-drag) ends. */
  toolBeforePan: ToolId | null

  viewport: Viewport
  stageSize: { width: number; height: number }

  selection: SelectionRef[]
  hover: SelectionRef | null
  pickCycle: PickCycleState | null
  /** "3 of 7" readout after a cycling click. */
  pickStatus: { depth: number; total: number } | null

  /** Asset queued for placement; the next canvas click drops it. */
  placingAssetId: string | null

  plotMaterialId: string
  plotMode: PaintMode
  /** Vertices committed so far in the current plot outline. */
  plotDraft: Vec2[]
  /** Live cursor position, drawn as the provisional next vertex. */
  plotCursor: Vec2 | null

  /** Surface whose vertices are currently editable. */
  editingSurfaceId: string | null

  measure: MeasureState | null

  /** Work on one band with the rest dimmed and unclickable. */
  isolatedBand: BandId | null
  hiddenBands: BandId[]
  lockedBands: BandId[]

  snapToGrid: boolean
  snapToGeometry: boolean
  /** Constrain rotation and plot edges to 15 degree steps. */
  angleSnap: boolean

  showGrid: boolean
  showLayers: boolean
  showInspector: boolean
  /** Sidebar visibility, so the plan can take the whole window. */
  showLeftPanel: boolean
  showRightPanel: boolean
  assetPanelCategory: string | null

  setTool: (tool: ToolId) => void
  setViewport: (viewport: Viewport | ((current: Viewport) => Viewport)) => void
  setStageSize: (size: { width: number; height: number }) => void

  select: (refs: SelectionRef[]) => void
  toggleSelect: (ref: SelectionRef) => void
  clearSelection: () => void
  setHover: (ref: SelectionRef | null) => void
  setPick: (cycle: PickCycleState | null, status: { depth: number; total: number } | null) => void

  setPlacing: (assetId: string | null) => void

  setPlotMaterial: (id: string) => void
  setPlotMode: (mode: PaintMode) => void
  addPlotPoint: (point: Vec2) => void
  setPlotCursor: (point: Vec2 | null) => void
  popPlotPoint: () => void
  clearPlot: () => void

  setEditingSurface: (id: string | null) => void
  setMeasure: (measure: MeasureState | null) => void

  setIsolatedBand: (band: BandId | null) => void
  toggleBandHidden: (band: BandId) => void
  toggleBandLocked: (band: BandId) => void

  toggle: (
    key:
      | 'snapToGrid'
      | 'snapToGeometry'
      | 'angleSnap'
      | 'showGrid'
      | 'showLayers'
      | 'showInspector'
      | 'showLeftPanel'
      | 'showRightPanel',
  ) => void
  setAssetPanelCategory: (id: string | null) => void
}

const sameRef = (a: SelectionRef, b: SelectionRef) => a.kind === b.kind && a.id === b.id

export const useEditorStore = create<EditorState>()((set, get) => ({
  tool: 'select',
  toolBeforePan: null,

  viewport: { ox: -8, oy: -6, scale: DEFAULT_SCALE },
  stageSize: { width: 1200, height: 800 },

  selection: [],
  hover: null,
  pickCycle: null,
  pickStatus: null,

  placingAssetId: null,

  plotMaterialId: 'lawn',
  plotMode: 'add',
  plotDraft: [],
  plotCursor: null,

  editingSurfaceId: null,
  measure: null,

  isolatedBand: null,
  hiddenBands: [],
  lockedBands: [],

  snapToGrid: false,
  snapToGeometry: true,
  angleSnap: false,

  showGrid: true,
  showLayers: true,
  showInspector: true,
  showLeftPanel: true,
  showRightPanel: true,
  assetPanelCategory: 'trees',

  setTool(tool) {
    const current = get().tool
    if (current === tool) return
    // Leaving the plot tool abandons any half-drawn outline.
    set({
      tool,
      plotDraft: tool === 'plot' ? get().plotDraft : [],
      plotCursor: null,
      measure: tool === 'measure' ? get().measure : null,
      placingAssetId: tool === 'select' ? get().placingAssetId : null,
    })
  },

  setViewport(next) {
    set((s) => ({ viewport: typeof next === 'function' ? next(s.viewport) : next }))
  },

  setStageSize(size) {
    const { stageSize } = get()
    if (stageSize.width === size.width && stageSize.height === size.height) return
    set({ stageSize: size })
  },

  select(refs) {
    set({ selection: refs })
  },

  toggleSelect(ref) {
    set((s) => {
      const exists = s.selection.some((r) => sameRef(r, ref))
      return {
        selection: exists ? s.selection.filter((r) => !sameRef(r, ref)) : [...s.selection, ref],
      }
    })
  },

  clearSelection() {
    set({ selection: [], pickCycle: null, pickStatus: null, editingSurfaceId: null })
  },

  setHover(ref) {
    const { hover } = get()
    if (hover === ref || (hover && ref && sameRef(hover, ref))) return
    set({ hover: ref })
  },

  setPick(cycle, status) {
    set({ pickCycle: cycle, pickStatus: status })
  },

  setPlacing(assetId) {
    set({ placingAssetId: assetId, tool: 'select' })
  },

  setPlotMaterial(id) {
    set({ plotMaterialId: id, tool: 'plot' })
  },

  setPlotMode(mode) {
    set({ plotMode: mode })
  },

  addPlotPoint(point) {
    set((s) => ({ plotDraft: [...s.plotDraft, point] }))
  },

  setPlotCursor(point) {
    set({ plotCursor: point })
  },

  popPlotPoint() {
    set((s) => ({ plotDraft: s.plotDraft.slice(0, -1) }))
  },

  clearPlot() {
    set({ plotDraft: [], plotCursor: null })
  },

  setEditingSurface(id) {
    set({ editingSurfaceId: id })
  },

  setMeasure(measure) {
    set({ measure })
  },

  setIsolatedBand(band) {
    set({ isolatedBand: band })
  },

  toggleBandHidden(band) {
    set((s) => ({
      hiddenBands: s.hiddenBands.includes(band)
        ? s.hiddenBands.filter((b) => b !== band)
        : [...s.hiddenBands, band],
    }))
  },

  toggleBandLocked(band) {
    set((s) => ({
      lockedBands: s.lockedBands.includes(band)
        ? s.lockedBands.filter((b) => b !== band)
        : [...s.lockedBands, band],
    }))
  },

  toggle(key) {
    set((s) => ({ [key]: !s[key] }) as Pick<EditorState, typeof key>)
  },

  setAssetPanelCategory(id) {
    set({ assetPanelCategory: id })
  },
}))

/** Non-reactive read, for event handlers. */
export const editor = () => useEditorStore.getState()

/** True when a band should not respond to clicks at all. */
export function bandIsInteractive(state: EditorState, band: BandId): boolean {
  if (state.hiddenBands.includes(band)) return false
  if (state.lockedBands.includes(band)) return false
  if (state.isolatedBand !== null && state.isolatedBand !== band) return false
  return true
}

export function bandIsVisible(state: EditorState, band: BandId): boolean {
  return !state.hiddenBands.includes(band)
}

/** Bands outside an isolation focus are drawn faint rather than hidden. */
export function bandOpacity(state: EditorState, band: BandId): number {
  if (state.isolatedBand === null || state.isolatedBand === band) return 1
  return 0.25
}
