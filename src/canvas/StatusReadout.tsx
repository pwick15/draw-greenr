import { getAsset } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'
import { BAND_META } from '@/core/types'
import { formatArea, formatDistance } from '@/core/viewport'
import { multiPolyArea } from '@/core/geometry'
import { spreadRings } from '@/core/mature'

/**
 * Bottom-left status strip. The depth readout ("3 of 7 here") is the visible
 * half of click cycling — without it, clicking the same spot twice and getting
 * a different object would read as a bug rather than a feature.
 */
export function StatusReadout() {
  const selection = useEditorStore((s) => s.selection)
  const pickStatus = useEditorStore((s) => s.pickStatus)
  const tool = useEditorStore((s) => s.tool)
  const plotDraft = useEditorStore((s) => s.plotDraft)
  const plotShape = useEditorStore((s) => s.plotShape)
  const pathWidth = useEditorStore((s) => s.pathWidth)
  const showSpread = useEditorStore((s) => s.showSpread)
  const isolatedBand = useEditorStore((s) => s.isolatedBand)
  const doc = useDocStore((s) => s.doc)

  const lines: string[] = []

  if (tool === 'plot') {
    if (plotShape === 'rect' || plotShape === 'ellipse') {
      lines.push(
        plotShape === 'rect'
          ? 'Drag out a rectangle · Shift for a square, Alt from the centre'
          : 'Drag out an oval · Shift for a circle, Alt from the centre',
      )
    } else if (plotShape === 'path') {
      const width = formatDistance(pathWidth)
      if (plotDraft.length === 0) lines.push(`Click to start a ${width} path`)
      else if (plotDraft.length === 1) lines.push(`${width} wide · click the next point`)
      else lines.push(`${plotDraft.length} points · Enter to finish, first point to loop`)
    } else if (plotDraft.length === 0) {
      lines.push('Click to place the first corner')
    } else if (plotDraft.length < 3) {
      lines.push(`${plotDraft.length} of 3 corners — keep clicking`)
    } else {
      lines.push(`${plotDraft.length} corners · Enter or click the first point to finish`)
    }
  }

  if (showSpread) {
    const rings = spreadRings(Object.values(doc.objects))
    const crowded = rings.filter((r) => r.crowded).length
    if (rings.length === 0) lines.push('No plants with a known mature size yet')
    else if (crowded === 0) lines.push(`${rings.length} plants · none crowded at mature size`)
    else lines.push(`${crowded} of ${rings.length} plants will crowd at mature size`)
  }

  if (selection.length === 1) {
    const ref = selection[0]
    if (ref.kind === 'object') {
      const object = doc.objects[ref.id]
      if (object) {
        const asset = getAsset(object.assetId)
        lines.push(
          `${object.label ?? asset?.name ?? 'Object'} · ${formatDistance(object.w)} × ${formatDistance(object.h)} · ${Math.round(((object.rotation % 360) + 360) % 360)}°`,
        )
      }
    } else {
      const surface = doc.surfaces.find((s) => s.id === ref.id)
      if (surface) lines.push(`Surface · ${formatArea(multiPolyArea(surface.geometry))}`)
    }
  } else if (selection.length > 1) {
    lines.push(`${selection.length} selected`)
  }

  if (pickStatus && pickStatus.total > 1) {
    lines.push(`${pickStatus.depth} of ${pickStatus.total} here — click again to go deeper`)
  }

  if (isolatedBand !== null) {
    lines.push(`Editing ${BAND_META[isolatedBand].name} only`)
  }

  if (lines.length === 0) return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-sm flex-col gap-1">
      {lines.map((line, i) => (
        <div
          key={i}
          className="w-fit rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] leading-none text-stone-700 shadow-sm ring-1 ring-black/5"
        >
          {line}
        </div>
      ))}
    </div>
  )
}
