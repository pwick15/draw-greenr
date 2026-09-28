import type Konva from 'konva'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { Image as KonvaImage, Layer, Rect as KonvaRect, Shape } from 'react-konva'

import { getImage, preloadImages, useImageCacheVersion } from '@/core/imageCache'
import { objectBounds, rectIntersects } from '@/core/geometry'
import { objectZ } from '@/core/picking'
import type { AssetDef, BandId, GardenDoc, GardenObject, MaterialDef, Rect, Surface } from '@/core/types'
import { Band } from '@/core/types'

interface ContentLayerProps {
  doc: GardenDoc
  assets: ReadonlyMap<string, AssetDef>
  materials: ReadonlyMap<string, MaterialDef>
  /** World rectangle currently on screen, for culling. */
  visible: Rect
  /**
   * Band state arrives as plain data rather than predicates: a callback that
   * reads the store non-reactively would be referentially stable, and `memo`
   * would then skip the redraw when a band is hidden or isolated.
   */
  hiddenBands: readonly BandId[]
  isolatedBand: BandId | null
}

/** Bands outside an isolation focus are drawn faint rather than removed. */
const ISOLATION_DIM = 0.25

/**
 * All document content, on a single non-listening Konva layer.
 *
 * `listening={false}` switches off Konva's hit canvas entirely — it stops
 * maintaining a parallel colour-keyed bitmap for every node. Picking is done
 * in `core/picking` against per-asset alpha masks instead, which is both
 * cheaper and far more controllable (alpha-accurate hits, click cycling,
 * band-aware priority).
 */
export const ContentLayer = memo(function ContentLayer({
  doc,
  assets,
  materials,
  visible,
  hiddenBands,
  isolatedBand,
}: ContentLayerProps) {
  // One subscription for the whole layer: individual nodes must not each
  // subscribe to the image cache or a cold load re-renders hundreds of them.
  useImageCacheVersion()

  const bandVisible = useCallback((band: BandId) => !hiddenBands.includes(band), [hiddenBands])
  const bandOpacity = useCallback(
    (band: BandId) => (isolatedBand === null || isolatedBand === band ? 1 : ISOLATION_DIM),
    [isolatedBand],
  )

  const objects = useMemo(() => {
    const list: GardenObject[] = []
    for (const o of Object.values(doc.objects)) {
      if (o.hidden || !bandVisible(o.band)) continue
      if (!rectIntersects(objectBounds(o), visible)) continue
      list.push(o)
    }
    return list.sort((a, b) => objectZ(a) - objectZ(b))
  }, [doc.objects, visible, bandVisible])

  const surfaces = useMemo(
    () => doc.surfaces.filter((s) => !s.hidden).sort((a, b) => a.order - b.order),
    [doc.surfaces],
  )

  /**
   * Artwork actually referenced by the plan. Keyed on distinct assets rather
   * than on objects, so a hundred oaks cost one decode — and deliberately not
   * limited to the visible set, which would make artwork pop in while panning.
   */
  const usedSources = useMemo(() => {
    const set = new Set<string>()
    for (const o of Object.values(doc.objects)) {
      const asset = assets.get(o.assetId)
      if (asset) set.add(asset.src)
    }
    for (const s of doc.surfaces) {
      const material = materials.get(s.materialId)
      if (material?.textureSrc) set.add(material.textureSrc)
    }
    return set
  }, [doc.objects, doc.surfaces, assets, materials])

  // Nothing else pulls object artwork into the cache: the asset panel's <img>
  // tags warm the browser cache, not this one, and picking needs the decoded
  // pixels for its alpha masks.
  useEffect(() => {
    void preloadImages(usedSources)
  }, [usedSources])

  const terrainOpacity = bandOpacity(Band.Terrain)

  return (
    <Layer listening={false}>
      {bandVisible(Band.Terrain) &&
        surfaces.map((surface) => (
          <SurfaceShape
            key={surface.id}
            surface={surface}
            material={materials.get(surface.materialId)}
            opacity={surface.opacity * terrainOpacity}
          />
        ))}
      {objects.map((object) => (
        <ObjectNode
          key={object.id}
          object={object}
          asset={assets.get(object.assetId)}
          opacity={object.opacity * bandOpacity(object.band)}
        />
      ))}
    </Layer>
  )
})

// ---------------------------------------------------------------------------

interface SurfaceShapeProps {
  surface: Surface
  material: MaterialDef | undefined
  opacity: number
}

const FALLBACK_FILL = '#b9c2b4'

function SurfaceShape({ surface, material, opacity }: SurfaceShapeProps) {
  const texture = material?.textureSrc ? getImage(material.textureSrc)?.image : undefined

  const sceneFunc = useMemo(
    () => (context: Konva.Context, shape: Konva.Shape) => {
      context.beginPath()
      for (const poly of surface.geometry) {
        for (const ring of poly) {
          if (ring.length < 3) continue
          context.moveTo(ring[0][0], ring[0][1])
          for (let i = 1; i < ring.length; i++) context.lineTo(ring[i][0], ring[i][1])
          context.closePath()
        }
      }
      // Holes are just more rings; even-odd resolves them without caring which
      // way round any of them wind, which is what polyclip hands back.
      context.fillStrokeShape(shape)
    },
    [surface.geometry],
  )

  // A texture tile is 256 px and represents `textureScale` metres of ground.
  const patternScale = material ? material.textureScale / 256 : 1

  return (
    <Shape
      sceneFunc={sceneFunc}
      fillRule="evenodd"
      fill={texture ? undefined : (material?.fill ?? FALLBACK_FILL)}
      fillPatternImage={texture}
      fillPatternRepeat="repeat"
      fillPatternScale={texture ? { x: patternScale, y: patternScale } : undefined}
      fillPriority={texture ? 'pattern' : 'color'}
      stroke={material?.stroke}
      strokeWidth={material?.strokeWidth ?? 0}
      strokeScaleEnabled
      opacity={opacity}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      listening={false}
    />
  )
}

// ---------------------------------------------------------------------------

interface ObjectNodeProps {
  object: GardenObject
  asset: AssetDef | undefined
  opacity: number
}

function ObjectNode({ object, asset, opacity }: ObjectNodeProps) {
  const image = asset ? getImage(asset.src)?.image : undefined

  if (!image) {
    // Brief placeholder while the artwork decodes. Deliberately a hairline
    // outline rather than a filled block: if a custom asset's artwork ever
    // goes missing, an empty frame reads as "nothing here yet" instead of
    // looking like a grey rectangle someone placed on purpose.
    return (
      <KonvaRect
        x={object.x}
        y={object.y}
        width={object.w}
        height={object.h}
        offsetX={object.w / 2}
        offsetY={object.h / 2}
        rotation={object.rotation}
        stroke="rgba(110, 130, 112, 0.5)"
        strokeWidth={Math.min(object.w, object.h) * 0.02}
        dash={[object.w * 0.06, object.w * 0.04]}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />
    )
  }

  return (
    <KonvaImage
      image={image}
      x={object.x}
      y={object.y}
      width={object.w}
      height={object.h}
      offsetX={object.w / 2}
      offsetY={object.h / 2}
      rotation={object.rotation}
      // Mirroring about the offset origin keeps the centre — and therefore the
      // rotation pivot — exactly where it was.
      scaleX={object.flipX ? -1 : 1}
      scaleY={object.flipY ? -1 : 1}
      opacity={opacity}
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  )
}
