import type { KonvaEventObject } from 'konva/lib/Node'
import { useMemo } from 'react'
import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Label,
  Layer,
  Line,
  Rect,
  Tag,
  Text,
} from 'react-konva'

import { dist, objectBounds, pointInPoly, polyArea } from '@/core/geometry'
import { useLoadedImage } from '@/core/imageCache'
import { spreadRings, type SpreadRing } from '@/core/mature'
import { pathLength } from '@/core/shapes'
import type { ObjectShadow } from '@/core/shadows'
import type { Guide } from '@/core/snapping'
import { surfaceVertices, type VertexRef } from '@/core/surfaces'
import {
  ALL_HANDLES,
  boxHandlePoint,
  handleCursor,
  handlePoint,
  selectionBounds,
  type HandleId,
} from '@/core/transform'
import type {
  AssetDef,
  GardenDoc,
  GardenObject,
  Rect as WorldRect,
  SelectionRef,
  Surface,
  Vec2,
} from '@/core/types'
import { formatArea, formatDistance } from '@/core/viewport'
import type { MeasureState, PlotShape } from '@/state/editor'

const ACCENT = '#1f8f5f'
const ACCENT_SOFT = 'rgba(31, 143, 95, 0.9)'
const HOVER = 'rgba(31, 143, 95, 0.55)'
const GUIDE = '#e0407a'
const DRAFT = '#1f6f8f'
const CROWDED = '#d97706'

interface OverlayLayerProps {
  doc: GardenDoc
  scale: number
  selection: SelectionRef[]
  hover: SelectionRef | null
  guides: Guide[]
  marquee: WorldRect | null
  plotDraft: Vec2[]
  plotCursor: Vec2 | null
  plotActive: boolean
  plotShape: PlotShape
  pathWidth: number
  stampRect: WorldRect | null
  showSpread: boolean
  shadows: ObjectShadow[]
  /** Asset queued for placement, and where it would land. */
  placement: { asset: AssetDef; point: Vec2 } | null
  measure: MeasureState | null
  editingSurfaceId: string | null
  editingSurfacePoint: Vec2 | null
  hoverPolyIndex: number | null
  gestureKind: string
  onHandleDown: (handle: HandleId, event: KonvaEventObject<PointerEvent>) => void
  onRotateDown: (event: KonvaEventObject<PointerEvent>) => void
  onVertexDown: (surfaceId: string, ref: VertexRef, event: KonvaEventObject<PointerEvent>) => void
}

export function OverlayLayer({
  doc,
  scale,
  selection,
  hover,
  guides,
  marquee,
  plotDraft,
  plotCursor,
  plotActive,
  plotShape,
  pathWidth,
  stampRect,
  showSpread,
  shadows,
  placement,
  measure,
  editingSurfaceId,
  editingSurfacePoint,
  hoverPolyIndex,
  gestureKind,
  onHandleDown,
  onRotateDown,
  onVertexDown,
}: OverlayLayerProps) {
  // Everything in this layer is specified in screen pixels and divided by the
  // stage scale, so handles stay the same physical size at every zoom.
  const px = 1 / scale

  const selectedObjects = selection
    .filter((r) => r.kind === 'object')
    .map((r) => doc.objects[r.id])
    .filter((o): o is GardenObject => Boolean(o))

  const selectedSurfaces = selection
    .filter((r) => r.kind === 'surface')
    .map((r) => doc.surfaces.find((s) => s.id === r.id))
    .filter((s): s is Surface => Boolean(s))

  const hoverObject = hover?.kind === 'object' ? doc.objects[hover.id] : undefined
  const hoverSurface =
    hover?.kind === 'surface' ? doc.surfaces.find((s) => s.id === hover.id) : undefined

  const groupBox = selectedObjects.length > 1 ? selectionBounds(selectedObjects) : null
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null
  const transforming = gestureKind === 'resize' || gestureKind === 'rotate' || gestureKind === 'move'

  /**
   * Highlight the patch that was clicked, not every patch of its material.
   *
   * Falls back to the whole surface when there is no click point — which is
   * what selecting the material's row in the layers panel means, and matches
   * what deleting it will do.
   */
  const selectedPolyIndex = (surface: Surface): number | null => {
    if (!editingSurfacePoint) return null
    const index = surface.geometry.findIndex((poly) => pointInPoly(poly, editingSurfacePoint))
    return index < 0 ? null : index
  }

  // Only recomputed when the objects themselves change: the pairwise crowding
  // pass is cheap but not free, and this layer re-renders on every drag frame.
  const rings = useMemo(
    () => (showSpread ? spreadRings(Object.values(doc.objects)) : []),
    [showSpread, doc.objects],
  )

  return (
    <Layer>
      {/* Underneath everything else — these are context for the plan, not
          selection cues, and must not obscure what they comment on. */}
      {shadows.length > 0 && <ShadowOverlay shadows={shadows} />}
      {rings.length > 0 && <SpreadOverlay px={px} rings={rings} />}

      {/* Hover cue: never changes stacking, only draws an outline in place. */}
      {hoverObject && !selection.some((r) => r.id === hoverObject.id) && (
        <OrientedOutline object={hoverObject} stroke={HOVER} width={1.5 * px} dash={null} />
      )}
      {hoverSurface && !selection.some((r) => r.id === hoverSurface.id) && (
        <SurfaceOutline
          surface={hoverSurface}
          stroke={HOVER}
          width={1.5 * px}
          only={hoverPolyIndex}
        />
      )}

      {selectedSurfaces.map((surface) => (
        <SurfaceOutline
          key={surface.id}
          surface={surface}
          stroke={ACCENT}
          width={1.5 * px}
          only={selectedPolyIndex(surface)}
        />
      ))}

      {selectedObjects.map((object) => (
        <OrientedOutline
          key={object.id}
          object={object}
          stroke={ACCENT}
          width={1.5 * px}
          dash={selectedObjects.length > 1 ? [4 * px, 3 * px] : null}
        />
      ))}

      {/* Transform handles: single object follows its rotation, a group gets an
          axis-aligned box. */}
      {single && !single.locked && (
        <TransformHandles
          px={px}
          points={ALL_HANDLES.map((h) => ({ handle: h, point: handlePoint(single, h) }))}
          rotation={single.rotation}
          rotateAnchor={rotateAnchorFor(single, px)}
          onHandleDown={onHandleDown}
          onRotateDown={onRotateDown}
        />
      )}
      {groupBox && (
        <>
          <Rect
            x={groupBox.x}
            y={groupBox.y}
            width={groupBox.w}
            height={groupBox.h}
            stroke={ACCENT}
            strokeWidth={1.5 * px}
            dash={[5 * px, 4 * px]}
            listening={false}
            perfectDrawEnabled={false}
          />
          <TransformHandles
            px={px}
            points={ALL_HANDLES.map((h) => ({ handle: h, point: boxHandlePoint(groupBox, h) }))}
            rotation={0}
            rotateAnchor={{ x: groupBox.x + groupBox.w / 2, y: groupBox.y - 24 * px }}
            onHandleDown={onHandleDown}
            onRotateDown={onRotateDown}
          />
        </>
      )}

      {/* Live dimensions while transforming. */}
      {single && transforming && (
        <ReadoutLabel
          px={px}
          x={single.x}
          y={objectBounds(single).y - 12 * px}
          text={
            gestureKind === 'rotate'
              ? `${Math.round(((single.rotation % 360) + 360) % 360)}°`
              : `${formatDistance(single.w)} × ${formatDistance(single.h)}`
          }
        />
      )}

      {/* Surface vertex editing. */}
      {editingSurfaceId &&
        (() => {
          const surface = doc.surfaces.find((s) => s.id === editingSurfaceId)
          if (!surface || surface.locked) return null
          // Corners of the clicked patch only. Every patch of a material lives
          // in one surface, so handing out all of them scatters draggable dots
          // across paving at the other end of the garden.
          const only = selectedPolyIndex(surface)
          return surfaceVertices(surface)
            .filter((v) => only === null || v.polyIndex === only)
            .map((vertex) => (
            <Circle
              key={`${vertex.polyIndex}-${vertex.ringIndex}-${vertex.vertexIndex}`}
              x={vertex.point.x}
              y={vertex.point.y}
              radius={4 * px}
              fill={vertex.isHole ? '#ffffff' : ACCENT}
              stroke={vertex.isHole ? ACCENT : '#ffffff'}
              strokeWidth={1.5 * px}
              hitStrokeWidth={10 * px}
              onPointerDown={(e) =>
                onVertexDown(
                  surface.id,
                  {
                    polyIndex: vertex.polyIndex,
                    ringIndex: vertex.ringIndex,
                    vertexIndex: vertex.vertexIndex,
                  } satisfies VertexRef,
                  e,
                )
              }
              onMouseEnter={(e) => setCursor(e, 'move')}
              onMouseLeave={(e) => setCursor(e, 'default')}
              perfectDrawEnabled={false}
            />
          ))
        })()}

      {/* Alignment guides. */}
      {guides.map((guide, i) =>
        guide.axis === 'x' ? (
          <Line
            key={`gx${i}`}
            points={[guide.value, guide.from - 20 * px, guide.value, guide.to + 20 * px]}
            stroke={GUIDE}
            strokeWidth={1 * px}
            dash={[4 * px, 3 * px]}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Line
            key={`gy${i}`}
            points={[guide.from - 20 * px, guide.value, guide.to + 20 * px, guide.value]}
            stroke={GUIDE}
            strokeWidth={1 * px}
            dash={[4 * px, 3 * px]}
            listening={false}
            perfectDrawEnabled={false}
          />
        ),
      )}

      {marquee && (
        <Rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill="rgba(31, 143, 95, 0.10)"
          stroke={ACCENT_SOFT}
          strokeWidth={1 * px}
          dash={[4 * px, 3 * px]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {plotActive && plotShape === 'path' && (
        <PathPreview px={px} draft={plotDraft} cursor={plotCursor} width={pathWidth} />
      )}
      {plotActive && plotShape === 'polygon' && (
        <PlotPreview px={px} draft={plotDraft} cursor={plotCursor} />
      )}
      {stampRect && <StampPreview px={px} rect={stampRect} round={plotShape === 'ellipse'} />}

      {placement && <PlacementPreview px={px} asset={placement.asset} at={placement.point} />}

      {measure && <MeasureOverlay px={px} measure={measure} />}
    </Layer>
  )
}

// ---------------------------------------------------------------------------

function rotateAnchorFor(object: GardenObject, px: number): Vec2 {
  const top = handlePoint(object, 'n')
  const rad = ((object.rotation - 90) * Math.PI) / 180
  return { x: top.x + Math.cos(rad) * 24 * px, y: top.y + Math.sin(rad) * 24 * px }
}

function setCursor(event: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = event.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}

interface OrientedOutlineProps {
  object: GardenObject
  stroke: string
  width: number
  dash: number[] | null
}

function OrientedOutline({ object, stroke, width, dash }: OrientedOutlineProps) {
  return (
    <Rect
      x={object.x}
      y={object.y}
      width={object.w}
      height={object.h}
      offsetX={object.w / 2}
      offsetY={object.h / 2}
      rotation={object.rotation}
      stroke={stroke}
      strokeWidth={width}
      dash={dash ?? undefined}
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  )
}

/**
 * Outline a surface — or, given an index, just one patch of it.
 *
 * One surface holds every patch of its material, so outlining the whole record
 * lights up paving on the other side of the garden when you click one slab.
 * `only` narrows that to the patch actually under the pointer.
 */
function SurfaceOutline({
  surface,
  stroke,
  width,
  only,
}: {
  surface: Surface
  stroke: string
  width: number
  only?: number | null
}) {
  const polys =
    only === null || only === undefined
      ? surface.geometry.map((poly, pi) => [poly, pi] as const)
      : surface.geometry[only]
        ? [[surface.geometry[only], only] as const]
        : []

  return (
    <>
      {polys.map(([poly, pi]) =>
        poly.map((ring, ri) => (
          <Line
            key={`${pi}-${ri}`}
            points={ring.flat()}
            closed
            stroke={stroke}
            strokeWidth={width}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        )),
      )}
    </>
  )
}

interface TransformHandlesProps {
  px: number
  points: { handle: HandleId; point: Vec2 }[]
  rotation: number
  rotateAnchor: Vec2
  onHandleDown: (handle: HandleId, event: KonvaEventObject<PointerEvent>) => void
  onRotateDown: (event: KonvaEventObject<PointerEvent>) => void
}

function TransformHandles({
  px,
  points,
  rotation,
  rotateAnchor,
  onHandleDown,
  onRotateDown,
}: TransformHandlesProps) {
  const size = 8 * px
  return (
    <Group>
      {points.map(({ handle, point }) => (
        <Rect
          key={handle}
          x={point.x}
          y={point.y}
          width={size}
          height={size}
          offsetX={size / 2}
          offsetY={size / 2}
          rotation={rotation}
          fill="#ffffff"
          stroke={ACCENT}
          strokeWidth={1.5 * px}
          cornerRadius={1.5 * px}
          hitStrokeWidth={8 * px}
          onPointerDown={(e) => onHandleDown(handle, e)}
          onMouseEnter={(e) => setCursor(e, handleCursor(handle, rotation))}
          onMouseLeave={(e) => setCursor(e, 'default')}
          perfectDrawEnabled={false}
        />
      ))}
      <Circle
        x={rotateAnchor.x}
        y={rotateAnchor.y}
        radius={5 * px}
        fill="#ffffff"
        stroke={ACCENT}
        strokeWidth={1.5 * px}
        hitStrokeWidth={10 * px}
        onPointerDown={onRotateDown}
        onMouseEnter={(e) => setCursor(e, 'grab')}
        onMouseLeave={(e) => setCursor(e, 'default')}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

// ---------------------------------------------------------------------------

interface PlotPreviewProps {
  px: number
  draft: Vec2[]
  cursor: Vec2 | null
}

/**
 * Live outline of the plot being drawn.
 *
 * Gardena shows the filled preview and nothing else. Showing the running edge
 * length and enclosed area while drawing is the difference between sketching
 * a lawn and actually laying one out to a measured size.
 */
function PlotPreview({ px, draft, cursor }: PlotPreviewProps) {
  const points = cursor ? [...draft, cursor] : draft
  if (points.length === 0) return null

  const flat = points.flatMap((p) => [p.x, p.y])
  const closable = draft.length >= 3
  const area = points.length >= 3 ? polyArea([points.map((p) => [p.x, p.y] as [number, number])]) : 0
  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 },
  )

  return (
    <Group listening={false}>
      {points.length >= 3 && (
        <Line
          points={flat}
          closed
          fill="rgba(31, 111, 143, 0.18)"
          stroke={DRAFT}
          strokeWidth={1.5 * px}
          perfectDrawEnabled={false}
        />
      )}
      {points.length === 2 && (
        <Line points={flat} stroke={DRAFT} strokeWidth={1.5 * px} perfectDrawEnabled={false} />
      )}

      {/* Edge lengths, including the live one under the cursor. */}
      {points.map((p, i) => {
        const next = points[(i + 1) % points.length]
        if (points.length < 2) return null
        if (i === points.length - 1 && points.length < 3) return null
        const length = dist(p, next)
        if (length * (1 / px) < 34) return null
        return (
          <ReadoutLabel
            key={`edge${i}`}
            px={px}
            x={(p.x + next.x) / 2}
            y={(p.y + next.y) / 2}
            text={formatDistance(length)}
            subtle
          />
        )
      })}

      {area > 0 && <ReadoutLabel px={px} x={centroid.x} y={centroid.y} text={formatArea(area)} />}

      {draft.map((p, i) => (
        <Circle
          key={`v${i}`}
          x={p.x}
          y={p.y}
          radius={(i === 0 && closable ? 6 : 4) * px}
          fill={i === 0 && closable ? '#ffffff' : DRAFT}
          stroke={DRAFT}
          strokeWidth={1.5 * px}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

/**
 * Ground shadows at the chosen time of year.
 *
 * Deliberately flat and unstroked: overlapping shadows compound into darker
 * pools, which is both what light does and the useful signal — the darkest
 * patch on the plan is the one nothing will grow in.
 */
function ShadowOverlay({ shadows }: { shadows: ObjectShadow[] }) {
  return (
    <Group listening={false}>
      {shadows.map((shadow) => (
        <Line
          key={shadow.objectId}
          points={shadow.ring.flat()}
          closed
          fill="rgba(38, 54, 44, 0.17)"
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ))}
    </Group>
  )
}

/**
 * Mature footprints, drawn under the plan.
 *
 * Amber is the point of the whole overlay: it marks a plant whose grown crown
 * would run into its neighbour's, which is invisible when everything is drawn
 * at the size it arrives from the nursery.
 */
function SpreadOverlay({ px, rings }: { px: number; rings: SpreadRing[] }) {
  return (
    <Group listening={false}>
      {rings.map((ring) => (
        <Circle
          key={ring.objectId}
          x={ring.centre.x}
          y={ring.centre.y}
          radius={ring.radius}
          fill={ring.crowded ? 'rgba(217, 119, 6, 0.11)' : 'rgba(31, 143, 95, 0.07)'}
          stroke={ring.crowded ? CROWDED : ACCENT_SOFT}
          strokeWidth={1.2 * px}
          dash={[6 * px, 4 * px]}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ))}
    </Group>
  )
}

/**
 * Live box for a rectangular or round stamp.
 *
 * Both the running dimensions and the area are on screen while dragging,
 * because the reason to stamp a rectangle instead of drawing one is to get a
 * patio that is actually 4 x 3 metres.
 */
function StampPreview({ px, rect, round }: { px: number; rect: WorldRect; round: boolean }) {
  const area = round ? (Math.PI * rect.w * rect.h) / 4 : rect.w * rect.h
  const fill = 'rgba(31, 111, 143, 0.18)'

  return (
    <Group listening={false}>
      {round ? (
        <Ellipse
          x={rect.x + rect.w / 2}
          y={rect.y + rect.h / 2}
          radiusX={rect.w / 2}
          radiusY={rect.h / 2}
          fill={fill}
          stroke={DRAFT}
          strokeWidth={1.5 * px}
          perfectDrawEnabled={false}
        />
      ) : (
        <Rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill={fill}
          stroke={DRAFT}
          strokeWidth={1.5 * px}
          perfectDrawEnabled={false}
        />
      )}
      <ReadoutLabel
        px={px}
        x={rect.x + rect.w / 2}
        y={rect.y - 11 * px}
        text={`${formatDistance(rect.w)} × ${formatDistance(rect.h)}`}
        subtle
      />
      {area > 0 && (
        <ReadoutLabel
          px={px}
          x={rect.x + rect.w / 2}
          y={rect.y + rect.h / 2}
          text={formatArea(area)}
        />
      )}
    </Group>
  )
}

/**
 * Live ribbon for the path tool.
 *
 * The preview is a Konva stroke with round caps and joins, which is precisely
 * the shape `strokePath` builds out of quads and discs — so what is on screen
 * while drawing is what gets committed, without running a boolean union on
 * every pointer move.
 */
function PathPreview({
  px,
  draft,
  cursor,
  width,
}: {
  px: number
  draft: Vec2[]
  cursor: Vec2 | null
  width: number
}) {
  const points = cursor ? [...draft, cursor] : draft
  if (points.length === 0) return null

  const flat = points.flatMap((p) => [p.x, p.y])
  const length = pathLength(points)
  const closable = draft.length >= 3
  const mid = points[Math.floor(points.length / 2)]

  return (
    <Group listening={false}>
      {points.length >= 2 && (
        <>
          <Line
            points={flat}
            stroke="rgba(31, 111, 143, 0.28)"
            strokeWidth={width}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
          />
          {/* Centreline, so the run is readable even at a hairline width. */}
          <Line
            points={flat}
            stroke={DRAFT}
            strokeWidth={1 * px}
            dash={[5 * px, 4 * px]}
            perfectDrawEnabled={false}
          />
        </>
      )}

      {points.map((p, i) => {
        const next = points[i + 1]
        if (!next) return null
        const segment = dist(p, next)
        if (segment / px < 34) return null
        return (
          <ReadoutLabel
            key={`seg${i}`}
            px={px}
            x={(p.x + next.x) / 2}
            y={(p.y + next.y) / 2}
            text={formatDistance(segment)}
            subtle
          />
        )
      })}

      {draft.map((p, i) => (
        <Circle
          key={`v${i}`}
          x={p.x}
          y={p.y}
          radius={(i === 0 && closable ? 6 : 4) * px}
          fill={i === 0 && closable ? '#ffffff' : DRAFT}
          stroke={DRAFT}
          strokeWidth={1.5 * px}
          perfectDrawEnabled={false}
        />
      ))}

      {length > 0 && (
        <ReadoutLabel
          px={px}
          x={mid.x}
          y={mid.y - 14 * px}
          text={`${formatDistance(length)} · ${formatArea(length * width)}`}
        />
      )}
    </Group>
  )
}

/**
 * Translucent preview of the asset about to be placed, drawn at its true size
 * at the point it would land. Answers both "which one did I pick" and "how big
 * is that actually" before committing to a click.
 */
function PlacementPreview({ px, asset, at }: { px: number; asset: AssetDef; at: Vec2 }) {
  // Not `getImage`: the asset being previewed is by definition not in the
  // document yet, so nothing has requested its artwork. This hook starts the
  // load and re-renders once it lands.
  const image = useLoadedImage(asset.src)?.image
  const { w, h } = asset.defaultSize

  return (
    <Group listening={false}>
      {image ? (
        <KonvaImage
          image={image}
          x={at.x}
          y={at.y}
          width={w}
          height={h}
          offsetX={w / 2}
          offsetY={h / 2}
          opacity={0.6}
          perfectDrawEnabled={false}
        />
      ) : null}
      <Rect
        x={at.x}
        y={at.y}
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        stroke={ACCENT}
        strokeWidth={1.25 * px}
        dash={[5 * px, 4 * px]}
        perfectDrawEnabled={false}
      />
      <Circle x={at.x} y={at.y} radius={2.5 * px} fill={ACCENT} perfectDrawEnabled={false} />
      <ReadoutLabel
        px={px}
        x={at.x}
        y={at.y + h / 2 + 11 * px}
        text={`${formatDistance(w)} × ${formatDistance(h)}`}
        subtle
      />
    </Group>
  )
}

function MeasureOverlay({ px, measure }: { px: number; measure: MeasureState }) {
  const length = dist(measure.from, measure.to)
  return (
    <Group listening={false}>
      <Line
        points={[measure.from.x, measure.from.y, measure.to.x, measure.to.y]}
        stroke={GUIDE}
        strokeWidth={1.5 * px}
        perfectDrawEnabled={false}
      />
      {[measure.from, measure.to].map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={3.5 * px} fill={GUIDE} perfectDrawEnabled={false} />
      ))}
      <ReadoutLabel
        px={px}
        x={(measure.from.x + measure.to.x) / 2}
        y={(measure.from.y + measure.to.y) / 2}
        text={formatDistance(length)}
      />
    </Group>
  )
}

interface ReadoutLabelProps {
  px: number
  x: number
  y: number
  text: string
  subtle?: boolean
}

function ReadoutLabel({ px, x, y, text, subtle }: ReadoutLabelProps) {
  const fontSize = 11 * px
  const padding = 3 * px
  // Konva's Label anchors top-left and only knows its width after layout, so
  // centre it on an estimate. These are short numeric strings in a sans face,
  // where 0.55em per glyph is within a pixel or two.
  const width = text.length * fontSize * 0.55 + padding * 2
  const height = fontSize * 1.3 + padding * 2

  return (
    <Label x={x} y={y} offsetX={width / 2} offsetY={height / 2} listening={false}>
      <Tag
        fill={subtle ? 'rgba(20, 38, 26, 0.72)' : 'rgba(20, 38, 26, 0.88)'}
        cornerRadius={3 * px}
        pointerDirection="none"
      />
      <Text
        text={text}
        fontSize={fontSize}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#ffffff"
        padding={padding}
      />
    </Label>
  )
}

