import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef, useState } from 'react'

import { dist, objectBounds, rectFromPoints } from '@/core/geometry'
import { pickInRect, resolvePick, type PickOptions } from '@/core/picking'
import { constrainAngle, snapPointToGrid, snapPlotPoint, snapRectToRects, type Guide } from '@/core/snapping'
import { eraseFromAll, moveVertex, paintSurface, pointsToRing, type VertexRef } from '@/core/surfaces'
import {
  angleTo,
  resizeGroup,
  resizeObject,
  rotateAbout,
  selectionBounds,
  snapAngle,
  type HandleId,
} from '@/core/transform'
import type { GardenObject, MultiPoly, Rect, SelectionRef, Vec2 } from '@/core/types'
import { screenToWorld, zoomAt } from '@/core/viewport'
import { getAsset, getAssets, getMaterials, useAssetStore } from '@/state/assets'
import { makeObject, topOfBand, useDocStore } from '@/state/document'
import { bandIsInteractive, useEditorStore } from '@/state/editor'

/** Click slop and snap radius, in screen pixels. */
const PICK_TOLERANCE_PX = 3
const SNAP_TOLERANCE_PX = 8
const DRAG_THRESHOLD_PX = 3

export type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; lastScreen: Vec2 }
  | { kind: 'marquee'; start: Vec2; current: Vec2; additive: boolean }
  | { kind: 'move'; startWorld: Vec2; startObjects: GardenObject[]; moved: boolean }
  | { kind: 'resize'; handle: HandleId; startObjects: GardenObject[]; startBox: Rect | null }
  | { kind: 'rotate'; pivot: Vec2; startAngle: number; startObjects: GardenObject[] }
  | { kind: 'vertex'; surfaceId: string; ref: VertexRef; startGeometry: MultiPoly }
  | { kind: 'measure'; from: Vec2 }

export interface InteractionApi {
  gestureKind: Gesture['kind']
  guides: Guide[]
  marquee: Rect | null
  cursor: string
  beginResize: (handle: HandleId, event: KonvaEventObject<PointerEvent>) => void
  beginRotate: (event: KonvaEventObject<PointerEvent>) => void
  beginVertexDrag: (surfaceId: string, ref: VertexRef, event: KonvaEventObject<PointerEvent>) => void
  onPointerDown: (event: KonvaEventObject<PointerEvent>) => void
  onPointerMove: (event: KonvaEventObject<PointerEvent>) => void
  onPointerUp: (event: KonvaEventObject<PointerEvent>) => void
  onWheel: (event: KonvaEventObject<WheelEvent>) => void
  onDoubleClick: (event: KonvaEventObject<MouseEvent>) => void
  commitPlot: () => void
  cancelPlot: () => void
}

export function usePlanInteraction(stageRef: React.RefObject<Konva.Stage | null>): InteractionApi {
  const gesture = useRef<Gesture>({ kind: 'none' })
  const [gestureKind, setGestureKind] = useState<Gesture['kind']>('none')
  const [guides, setGuides] = useState<Guide[]>([])
  const [marquee, setMarquee] = useState<Rect | null>(null)
  // Held in both a ref and state: the ref is what pointerdown reads mid-gesture,
  // the state is what the cursor renders from.
  const spaceDown = useRef(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const setGesture = useCallback((next: Gesture) => {
    gesture.current = next
    setGestureKind(next.kind)
  }, [])

  // --- helpers -------------------------------------------------------------

  const pointerWorld = useCallback((): Vec2 | null => {
    const stage = stageRef.current
    const position = stage?.getPointerPosition()
    if (!position) return null
    return screenToWorld(useEditorStore.getState().viewport, position)
  }, [stageRef])

  const worldPerPixel = () => 1 / useEditorStore.getState().viewport.scale

  const pickOptions = useCallback((): Partial<PickOptions> => {
    const state = useEditorStore.getState()
    return {
      tolerance: PICK_TOLERANCE_PX * worldPerPixel(),
      includeLocked: false,
      includeHidden: false,
      // Surfaces are enormous, so let them be clicked only when the terrain
      // band is genuinely the thing being worked on.
      includeSurfaces: bandIsInteractive(state, 0),
      onlyBand: state.isolatedBand ?? undefined,
    }
  }, [])

  const selectedObjects = useCallback((): GardenObject[] => {
    const { doc } = useDocStore.getState()
    return useEditorStore
      .getState()
      .selection.filter((r) => r.kind === 'object')
      .map((r) => doc.objects[r.id])
      .filter((o): o is GardenObject => Boolean(o) && !o.locked)
  }, [])

  // --- space to pan --------------------------------------------------------

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTextTarget(e.target)) {
        // Space otherwise scrolls the page under the canvas.
        e.preventDefault()
        spaceDown.current = true
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // --- placement -----------------------------------------------------------

  const placeAsset = useCallback((assetId: string, at: Vec2, keepPlacing: boolean) => {
    const asset = getAsset(assetId)
    if (!asset) return
    const { apply, doc } = useDocStore.getState()
    const editor = useEditorStore.getState()
    const point = editor.snapToGrid ? snapPointToGrid(at, doc.settings.gridSize) : at
    const object = makeObject(asset, point, { order: topOfBand(doc, asset.band) })
    apply(`Place ${asset.name}`, (draft) => {
      draft.objects[object.id] = object
    })
    editor.select([{ kind: 'object', id: object.id }])
    if (!keepPlacing) editor.setPlacing(null)
  }, [])

  // --- plot ----------------------------------------------------------------

  const commitPlot = useCallback(() => {
    const editor = useEditorStore.getState()
    const { plotDraft, plotMaterialId, plotMode } = editor
    if (plotDraft.length < 3) return
    const { apply, doc } = useDocStore.getState()
    const polygon: MultiPoly = [[pointsToRing(plotDraft)]]

    // Run the boolean ops on plain state *before* opening the immer recipe:
    // handing polyclip a draft would make it walk proxies for every vertex.
    const surfaces =
      plotMode === 'subtract'
        ? eraseFromAll(doc.surfaces, polygon)
        : paintSurface(doc.surfaces, getMaterials(), plotMaterialId, polygon, plotMode).surfaces

    apply(plotMode === 'subtract' ? 'Erase surface' : 'Draw surface', (draft) => {
      draft.surfaces = surfaces
    })
    editor.clearPlot()
  }, [])

  const cancelPlot = useCallback(() => {
    useEditorStore.getState().clearPlot()
  }, [])

  const addPlotVertex = useCallback(
    (raw: Vec2, angleLock: boolean) => {
      const editor = useEditorStore.getState()
      const { doc } = useDocStore.getState()
      const snapped = snapPlotPoint(raw, {
        surfaces: doc.surfaces,
        draft: editor.plotDraft,
        gridSize: doc.settings.gridSize,
        useGrid: editor.snapToGrid,
        useAngle: angleLock || editor.angleSnap,
        tolerance: SNAP_TOLERANCE_PX * worldPerPixel(),
      })
      if (snapped.closing) {
        commitPlot()
        return
      }
      // Reject a duplicate of the previous vertex — it produces a zero-length
      // edge that polyclip will choke on.
      const previous = editor.plotDraft[editor.plotDraft.length - 1]
      if (previous && dist(previous, snapped.point) < 1e-6) return
      editor.addPlotPoint(snapped.point)
    },
    [commitPlot],
  )

  // --- gesture starts ------------------------------------------------------

  const beginResize = useCallback(
    (handle: HandleId, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true
      const objects = selectedObjects()
      if (objects.length === 0) return
      useDocStore.getState().begin('Resize')
      setGesture({
        kind: 'resize',
        handle,
        startObjects: objects.map((o) => ({ ...o })),
        startBox: objects.length > 1 ? selectionBounds(objects) : null,
      })
    },
    [selectedObjects, setGesture],
  )

  const beginRotate = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true
      const objects = selectedObjects()
      const world = pointerWorld()
      if (objects.length === 0 || !world) return
      const box = selectionBounds(objects)
      if (!box) return
      const pivot = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
      useDocStore.getState().begin('Rotate')
      setGesture({
        kind: 'rotate',
        pivot,
        startAngle: angleTo(pivot, world),
        startObjects: objects.map((o) => ({ ...o })),
      })
    },
    [pointerWorld, selectedObjects, setGesture],
  )

  const beginVertexDrag = useCallback(
    (surfaceId: string, ref: VertexRef, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true
      const surface = useDocStore.getState().doc.surfaces.find((s) => s.id === surfaceId)
      if (!surface) return
      useDocStore.getState().begin('Reshape surface')
      setGesture({ kind: 'vertex', surfaceId, ref, startGeometry: surface.geometry })
    },
    [setGesture],
  )

  // --- pointer -------------------------------------------------------------

  const onPointerDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const world = pointerWorld()
      const stage = stageRef.current
      if (!world || !stage) return
      const editor = useEditorStore.getState()
      const native = event.evt
      const middle = native.button === 1
      const wantsPan = middle || spaceDown.current || editor.tool === 'pan'

      if (wantsPan) {
        native.preventDefault()
        const position = stage.getPointerPosition()
        if (position) setGesture({ kind: 'pan', lastScreen: position })
        return
      }
      if (native.button !== 0) return

      if (editor.placingAssetId) {
        placeAsset(editor.placingAssetId, world, native.altKey)
        return
      }

      if (editor.tool === 'plot') {
        addPlotVertex(world, native.shiftKey)
        return
      }

      if (editor.tool === 'measure') {
        setGesture({ kind: 'measure', from: world })
        editor.setMeasure({ from: world, to: world, done: false })
        return
      }

      // --- select ---
      const { doc } = useDocStore.getState()
      const additive = native.shiftKey || native.metaKey || native.ctrlKey
      const result = resolvePick(doc, getAssets(), world, editor.pickCycle, pickOptions(), native.altKey)

      if (!result.ref) {
        editor.setPick(null, null)
        if (!additive) editor.clearSelection()
        setGesture({ kind: 'marquee', start: world, current: world, additive })
        setMarquee({ x: world.x, y: world.y, w: 0, h: 0 })
        return
      }

      editor.setPick(result.cycle, { depth: result.depth, total: result.total })

      const already = editor.selection.some((r) => r.kind === result.ref!.kind && r.id === result.ref!.id)
      if (additive) {
        editor.toggleSelect(result.ref)
        return
      }
      if (!already) editor.select([result.ref])

      if (result.ref.kind === 'surface') {
        editor.setEditingSurface(result.ref.id)
        return
      }
      editor.setEditingSurface(null)

      const objects = selectedObjects()
      if (objects.length === 0) return
      useDocStore.getState().begin('Move')
      setGesture({
        kind: 'move',
        startWorld: world,
        startObjects: objects.map((o) => ({ ...o })),
        moved: false,
      })
    },
    [addPlotVertex, pickOptions, placeAsset, pointerWorld, selectedObjects, setGesture, stageRef],
  )

  const onPointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current
      const world = pointerWorld()
      if (!stage || !world) return
      const editor = useEditorStore.getState()
      const native = event.evt
      const current = gesture.current

      switch (current.kind) {
        case 'none': {
          if (editor.tool === 'plot') {
            const { doc } = useDocStore.getState()
            const snapped = snapPlotPoint(world, {
              surfaces: doc.surfaces,
              draft: editor.plotDraft,
              gridSize: doc.settings.gridSize,
              useGrid: editor.snapToGrid,
              useAngle: native.shiftKey || editor.angleSnap,
              tolerance: SNAP_TOLERANCE_PX * worldPerPixel(),
            })
            editor.setPlotCursor(snapped.point)
            return
          }
          if (editor.tool === 'select' && !editor.placingAssetId) {
            const { doc } = useDocStore.getState()
            const hit = resolvePick(doc, getAssets(), world, null, pickOptions(), false)
            editor.setHover(hit.ref)
          }
          return
        }

        case 'pan': {
          const position = stage.getPointerPosition()
          if (!position) return
          const dx = position.x - current.lastScreen.x
          const dy = position.y - current.lastScreen.y
          editor.setViewport((vp) => ({ ...vp, ox: vp.ox - dx / vp.scale, oy: vp.oy - dy / vp.scale }))
          gesture.current = { kind: 'pan', lastScreen: position }
          return
        }

        case 'marquee': {
          gesture.current = { ...current, current: world }
          setMarquee(rectFromPoints(current.start, world))
          return
        }

        case 'move': {
          const raw = { x: world.x - current.startWorld.x, y: world.y - current.startWorld.y }
          const movedFar =
            Math.hypot(raw.x, raw.y) * useEditorStore.getState().viewport.scale > DRAG_THRESHOLD_PX
          if (!movedFar && !current.moved) return
          gesture.current = { ...current, moved: true }

          let delta = raw
          // Shift locks to the dominant axis, as in every other editor.
          if (native.shiftKey) {
            if (Math.abs(raw.x) > Math.abs(raw.y)) delta = { x: raw.x, y: 0 }
            else delta = { x: 0, y: raw.y }
          }

          const { doc } = useDocStore.getState()
          let nextGuides: Guide[] = []

          if (editor.snapToGrid) {
            const first = current.startObjects[0]
            if (first) {
              const target = snapPointToGrid(
                { x: first.x + delta.x, y: first.y + delta.y },
                doc.settings.gridSize,
              )
              delta = { x: target.x - first.x, y: target.y - first.y }
            }
          } else if (editor.snapToGeometry) {
            const movingIds = new Set(current.startObjects.map((o) => o.id))
            const movingBox = boundsOfMoved(current.startObjects, delta)
            if (movingBox) {
              const statics: Rect[] = []
              for (const o of Object.values(doc.objects)) {
                if (movingIds.has(o.id) || o.hidden) continue
                statics.push(objectBounds(o))
              }
              const snap = snapRectToRects(movingBox, statics, SNAP_TOLERANCE_PX * worldPerPixel())
              delta = { x: delta.x + snap.delta.x, y: delta.y + snap.delta.y }
              nextGuides = snap.guides
            }
          }

          useDocStore.getState().update((draft) => {
            for (const start of current.startObjects) {
              const target = draft.objects[start.id]
              if (!target) continue
              target.x = start.x + delta.x
              target.y = start.y + delta.y
            }
          })
          setGuides(nextGuides)
          return
        }

        case 'resize': {
          const { doc } = useDocStore.getState()
          const options = {
            keepAspect: native.shiftKey !== isAspectLocked(current.startObjects),
            fromCentre: native.altKey,
            snap: editor.snapToGrid ? doc.settings.gridSize : 0,
          }
          if (current.startObjects.length === 1) {
            const start = current.startObjects[0]
            const box = resizeObject(start, current.handle, world, options)
            useDocStore.getState().update((draft) => {
              const target = draft.objects[start.id]
              if (!target) return
              target.x = box.x
              target.y = box.y
              target.w = box.w
              target.h = box.h
            })
          } else if (current.startBox) {
            const boxes = resizeGroup(current.startObjects, current.startBox, current.handle, world, options)
            useDocStore.getState().update((draft) => {
              for (const [id, box] of boxes) {
                const target = draft.objects[id]
                if (!target) continue
                target.x = box.x
                target.y = box.y
                target.w = box.w
                target.h = box.h
              }
            })
          }
          return
        }

        case 'rotate': {
          let delta = angleTo(current.pivot, world) - current.startAngle
          if (native.shiftKey !== editor.angleSnap) {
            const start = current.startObjects[0]
            delta = snapAngle(delta + (start?.rotation ?? 0), 15) - (start?.rotation ?? 0)
          }
          const placements = rotateAbout(current.startObjects, current.pivot, delta)
          useDocStore.getState().update((draft) => {
            for (const [id, placement] of placements) {
              const target = draft.objects[id]
              if (!target) continue
              target.x = placement.x
              target.y = placement.y
              target.rotation = placement.rotation
            }
          })
          return
        }

        case 'vertex': {
          const { doc } = useDocStore.getState()
          let point = world
          if (editor.snapToGrid) point = snapPointToGrid(point, doc.settings.gridSize)
          if (native.shiftKey) {
            const ring = current.startGeometry[current.ref.polyIndex]?.[current.ref.ringIndex]
            const previous = ring?.[(current.ref.vertexIndex - 1 + ring.length) % ring.length]
            if (previous) point = constrainAngle({ x: previous[0], y: previous[1] }, point, 15)
          }
          const geometry = moveVertex(current.startGeometry, current.ref, point)
          useDocStore.getState().update((draft) => {
            const surface = draft.surfaces.find((s) => s.id === current.surfaceId)
            if (surface) surface.geometry = geometry
          })
          return
        }

        case 'measure': {
          const point = native.shiftKey ? constrainAngle(current.from, world, 15) : world
          editor.setMeasure({ from: current.from, to: point, done: false })
          return
        }

        default:
          return
      }
    },
    [pickOptions, pointerWorld, stageRef],
  )

  const onPointerUp = useCallback(() => {
    const current = gesture.current
    const editor = useEditorStore.getState()
    const doc = useDocStore.getState()

    switch (current.kind) {
      case 'marquee': {
        const rect = rectFromPoints(current.start, current.current)
        // A click with no drag is just a deselect, already handled on down.
        if (rect.w * useEditorStore.getState().viewport.scale > DRAG_THRESHOLD_PX) {
          const hits = pickInRect(doc.doc, rect, { requireFullyInside: false, includeLocked: false })
          const filtered = hits.filter((ref) =>
            ref.kind === 'object' ? bandIsInteractive(editor, doc.doc.objects[ref.id].band) : true,
          )
          editor.select(
            current.additive ? dedupe([...editor.selection, ...filtered]) : filtered,
          )
        }
        setMarquee(null)
        break
      }
      case 'move':
      case 'resize':
      case 'rotate':
      case 'vertex':
        doc.end()
        setGuides([])
        break
      case 'measure':
        if (editor.measure) editor.setMeasure({ ...editor.measure, done: true })
        break
      default:
        break
    }
    setGesture({ kind: 'none' })
  }, [setGesture])

  const onWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault()
      const stage = stageRef.current
      const position = stage?.getPointerPosition()
      if (!position) return
      const native = event.evt
      const editor = useEditorStore.getState()

      // Trackpads send two-finger scroll as plain deltas; treat those as pan
      // and reserve zoom for pinch (ctrlKey) and the mouse wheel.
      const isPinch = native.ctrlKey || native.metaKey
      const isWheel = Math.abs(native.deltaY) > 0 && native.deltaMode !== 0

      if (isPinch || isWheel || (!native.deltaX && Math.abs(native.deltaY) > 40)) {
        const factor = Math.exp(-native.deltaY * (isPinch ? 0.01 : 0.0018))
        editor.setViewport((vp) => zoomAt(vp, position, factor))
        return
      }
      editor.setViewport((vp) => ({
        ...vp,
        ox: vp.ox + native.deltaX / vp.scale,
        oy: vp.oy + native.deltaY / vp.scale,
      }))
    },
    [stageRef],
  )

  const onDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const editor = useEditorStore.getState()
      if (editor.tool === 'plot' && editor.plotDraft.length >= 3) {
        event.evt.preventDefault()
        commitPlot()
      }
    },
    [commitPlot],
  )

  // Keep the asset store warm so picks have masks available.
  const ready = useAssetStore((s) => s.ready)
  useEffect(() => {
    if (!ready) void useAssetStore.getState().load()
  }, [ready])

  const cursor = cursorFor(gestureKind, spaceHeld)

  return {
    gestureKind,
    guides,
    marquee,
    cursor,
    beginResize,
    beginRotate,
    beginVertexDrag,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onDoubleClick,
    commitPlot,
    cancelPlot,
  }
}

// ---------------------------------------------------------------------------

function boundsOfMoved(objects: GardenObject[], delta: Vec2): Rect | null {
  return selectionBounds(objects.map((o) => ({ ...o, x: o.x + delta.x, y: o.y + delta.y })))
}

function isAspectLocked(objects: GardenObject[]): boolean {
  if (objects.length !== 1) return false
  return getAsset(objects[0].assetId)?.aspectLocked ?? false
}

function dedupe(refs: SelectionRef[]): SelectionRef[] {
  const seen = new Set<string>()
  return refs.filter((r) => {
    const key = `${r.kind}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cursorFor(kind: Gesture['kind'], space: boolean): string {
  if (kind === 'pan') return 'grabbing'
  if (space) return 'grab'
  if (kind === 'move') return 'grabbing'
  if (kind === 'marquee') return 'crosshair'
  return 'default'
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

