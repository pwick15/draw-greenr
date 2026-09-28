import type Konva from 'konva'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Stage } from 'react-konva'

import { screenToWorld, visibleRect } from '@/core/viewport'
import { getAsset, useAssetStore } from '@/state/assets'
import { makeObject, topOfBand, useDocStore } from '@/state/document'
import { zoomToFit } from '@/state/commands'
import { useEditorStore } from '@/state/editor'
import { registerStage } from '@/state/persistence'
import { isSupportedFile } from '@/assets/importAsset'
import { snapPointToGrid } from '@/core/snapping'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ASSET_DRAG_TYPE } from '@/ui/AssetPanel'

import { ContentLayer } from './ContentLayer'
import { GridLayer } from './GridLayer'
import { OverlayLayer } from './OverlayLayer'
import { ScaleBar } from './ScaleBar'
import { StatusReadout } from './StatusReadout'
import { usePlanInteraction } from './usePlanInteraction'

export interface PlanCanvasProps {
  /** An image file dropped straight onto the plan opens the import wizard. */
  onFileDropped: (file: File) => void
}

export function PlanCanvas({ onFileDropped }: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const framed = useRef(false)

  const doc = useDocStore((s) => s.doc)
  const assets = useAssetStore((s) => s.assets)
  const materials = useAssetStore((s) => s.materials)

  const viewport = useEditorStore((s) => s.viewport)
  const stageSize = useEditorStore((s) => s.stageSize)
  const selection = useEditorStore((s) => s.selection)
  const hover = useEditorStore((s) => s.hover)
  const plotDraft = useEditorStore((s) => s.plotDraft)
  const plotCursor = useEditorStore((s) => s.plotCursor)
  const measure = useEditorStore((s) => s.measure)
  const editingSurfaceId = useEditorStore((s) => s.editingSurfaceId)
  const tool = useEditorStore((s) => s.tool)
  const showGrid = useEditorStore((s) => s.showGrid)
  const hiddenBands = useEditorStore((s) => s.hiddenBands)
  const isolatedBand = useEditorStore((s) => s.isolatedBand)
  const setStageSize = useEditorStore((s) => s.setStageSize)

  const interaction = usePlanInteraction(stageRef)
  // The plot tool owns Enter/Escape/Backspace while an outline is open, so the
  // shortcut layer needs the same commit and cancel the canvas uses.
  useKeyboardShortcuts(interaction.commitPlot, interaction.cancelPlot)

  // Keep the Konva stage matched to its container.
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      setStageSize({ width: Math.floor(width), height: Math.floor(height) })

      // Frame a restored plan only once the canvas has a real size — doing it
      // at restore time would fit against a placeholder viewport.
      if (!framed.current) {
        framed.current = true
        const { doc: current } = useDocStore.getState()
        if (Object.keys(current.objects).length > 0 || current.surfaces.length > 0) {
          zoomToFit()
        }
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [setStageSize])

  useEffect(() => {
    void useAssetStore.getState().load()
  }, [])

  // Expose the stage so PNG export can capture the same renderer users see.
  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  }, [])

  /** Screen coordinates of a DOM drag event, relative to the canvas. */
  const dropWorld = useCallback((event: React.DragEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return screenToWorld(useEditorStore.getState().viewport, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const world = dropWorld(event)
      if (!world) return

      const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE)
      if (assetId) {
        const asset = getAsset(assetId)
        if (!asset) return
        const state = useDocStore.getState()
        const editorState = useEditorStore.getState()
        const at = editorState.snapToGrid
          ? snapPointToGrid(world, state.doc.settings.gridSize)
          : world
        const object = makeObject(asset, at, { order: topOfBand(state.doc, asset.band) })
        state.apply(`Place ${asset.name}`, (draft) => {
          draft.objects[object.id] = object
        })
        editorState.select([{ kind: 'object', id: object.id }])
        return
      }

      const file = event.dataTransfer.files?.[0]
      if (file && isSupportedFile(file)) onFileDropped(file)
    },
    [dropWorld, onFileDropped],
  )

  // Memoised so ContentLayer's `memo` has a chance of skipping a render; a
  // fresh object every frame would defeat it.
  const visible = useMemo(
    () => visibleRect(viewport, stageSize.width, stageSize.height),
    [viewport, stageSize.width, stageSize.height],
  )

  const placingAssetId = useEditorStore((s) => s.placingAssetId)
  const placementPoint = useEditorStore((s) => s.placementPoint)

  const placement = useMemo(() => {
    if (!placingAssetId || !placementPoint) return null
    const asset = assets.get(placingAssetId)
    return asset ? { asset, point: placementPoint } : null
  }, [placingAssetId, placementPoint, assets])

  const cursor =
    tool === 'plot' || tool === 'measure'
      ? 'crosshair'
      : placingAssetId
        ? 'copy'
        : interaction.cursor

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor, background: doc.settings.backgroundColor }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        // The viewport lives on the stage transform, so every layer below can
        // be authored directly in metres.
        x={-viewport.ox * viewport.scale}
        y={-viewport.oy * viewport.scale}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onPointerDown={interaction.onPointerDown}
        onPointerMove={interaction.onPointerMove}
        onPointerUp={interaction.onPointerUp}
        onPointerLeave={(e) => {
          interaction.onPointerUp(e)
          // Drop the preview and hover cue rather than leaving them stranded
          // at the edge where the pointer left.
          const state = useEditorStore.getState()
          state.setPlacementPoint(null)
          state.setHover(null)
        }}
        onWheel={interaction.onWheel}
        onDblClick={interaction.onDoubleClick}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {showGrid && <GridLayer visible={visible} scale={viewport.scale} baseSize={doc.settings.gridSize} />}
        <ContentLayer
          doc={doc}
          assets={assets}
          materials={materials}
          visible={visible}
          hiddenBands={hiddenBands}
          isolatedBand={isolatedBand}
        />
        <OverlayLayer
          doc={doc}
          scale={viewport.scale}
          selection={selection}
          hover={hover}
          guides={interaction.guides}
          marquee={interaction.marquee}
          plotDraft={plotDraft}
          plotCursor={plotCursor}
          plotActive={tool === 'plot'}
          placement={placement}
          measure={measure}
          editingSurfaceId={editingSurfaceId}
          gestureKind={interaction.gestureKind}
          onHandleDown={interaction.beginResize}
          onRotateDown={interaction.beginRotate}
          onVertexDown={interaction.beginVertexDrag}
        />
      </Stage>

      <StatusReadout />
      <ScaleBar scale={viewport.scale} />
    </div>
  )
}
