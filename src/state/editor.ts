import { create } from 'zustand'

import type { PickCycleState } from '@/core/picking'
import type { BandId, SelectionRef, Vec2, Viewport } from '@/core/types'
import type { PaintMode } from '@/core/surfaces'
import { EQUINOX_SPRING } from '@/core/sun'
import { DEFAULT_SCALE } from '@/core/viewport'

export type ToolId = 'select' | 'pan' | 'plot' | 'measure'

/**
 * How the plot tool gathers its outline.
 *
 * `polygon` is the click-a-corner-at-a-time original. The rest exist because
 * most ground in a real garden is a rectangle of paving or a round bed, and
 * clicking four corners to get a rectangle is busywork the tool should absorb.
 */
export type PlotShape = 'polygon' | 'rect' | 'ellipse' | 'path'

export interface MeasureState {
  from: Vec2
  to: Vec2
  done: boolean
}

/**
 * The offset a duplicate should repeat, and the objects it belongs to.
 *
 * Tying the offset to specific ids is what makes "repeat" stop at the right
 * moment: duplicating advances the ids to the new copies, so a run of ⌘D keeps
 * stepping, but selecting anything else no longer matches and the next
 * duplicate falls back to its default placement.
 */
export interface RepeatOffset {
  ids: string[]
  delta: Vec2
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
  /**
   * Cursor position in world metres, used to draw the translucent preview of
   * the asset about to be placed. Tracked *only* while something is queued for
   * placement — updating it on every pointer move would re-render the overlay
   * continuously for no reason.
   */
  placementPoint: Vec2 | null

  /** Offset for the next repeat-duplicate, or null to use the default. */
  repeatOffset: RepeatOffset | null

  plotMaterialId: string
  plotMode: PaintMode
  plotShape: PlotShape
  /** Width of a stroked path, in metres. */
  pathWidth: number
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
  /** Draw every plant at its mature spread, flagging the ones that collide. */
  showSpread: boolean
  /** Cast ground shadows from object heights at the chosen time of year. */
  showShadows: boolean
  /** Day of year and solar hour the shadow study is set to. */
  sunDay: number
  sunHour: number
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
  setPlacementPoint: (point: Vec2 | null) => void
  setRepeatOffset: (offset: RepeatOffset | null) => void

  setPlotMaterial: (id: string) => void
  setPlotMode: (mode: PaintMode) => void
  setPlotShape: (shape: PlotShape) => void
  setPathWidth: (metres: number) => void
  setSun: (patch: { day?: number; hour?: number }) => void
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
      | 'showSpread'
      | 'showShadows'
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
  placementPoint: null,
  repeatOffset: null,

  plotMaterialId: 'lawn',
  plotMode: 'add',
  plotShape: 'polygon',
  pathWidth: 1,
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
  showSpread: false,
  showShadows: false,
  // Opens on the spring equinox at mid-morning: the equinox is the honest
  // middle of the year, and mid-morning is when overshadowing actually bites.
  sunDay: EQUINOX_SPRING,
  sunHour: 10,
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
    set({
      placingAssetId: assetId,
      tool: 'select',
      placementPoint: assetId ? get().placementPoint : null,
    })
  },

  setPlacementPoint(point) {
    const current = get().placementPoint
    if (current === point) return
    if (current && point && current.x === point.x && current.y === point.y) return
    set({ placementPoint: point })
  },

  setRepeatOffset(offset) {
    set({ repeatOffset: offset })
  },

  setPlotMaterial(id) {
    set({ plotMaterialId: id, tool: 'plot' })
  },

  setPlotMode(mode) {
    set({ plotMode: mode })
  },

  setPlotShape(shape) {
    // A half-drawn outline means nothing once the shape changes under it.
    set({ plotShape: shape, plotDraft: [], plotCursor: null, tool: 'plot' })
  },

  setPathWidth(metres) {
    set({ pathWidth: Math.max(0.05, Math.min(20, metres)) })
  },

  setSun({ day, hour }) {
    set({
      sunDay: day === undefined ? get().sunDay : Math.max(1, Math.min(365, Math.round(day))),
      sunHour: hour === undefined ? get().sunHour : Math.max(0, Math.min(24, hour)),
    })
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
