import { memo } from 'react'

import { MAX_SCALE, MIN_SCALE, formatDistance, scaleBarSpec } from '@/core/viewport'
import { useEditorStore } from '@/state/editor'

/**
 * Alternating black/white scale bar, as on a printed site plan. The bar always
 * spans a round number of metres rather than a round number of pixels, so it
 * stays readable at every zoom step.
 */
export const ScaleBar = memo(function ScaleBar({ scale }: { scale: number }) {
  const spec = scaleBarSpec(scale)
  const setViewport = useEditorStore((s) => s.setViewport)
  const stageSize = useEditorStore((s) => s.stageSize)

  const zoomBy = (factor: number) => {
    const centre = { x: stageSize.width / 2, y: stageSize.height / 2 }
    setViewport((vp) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor))
      if (next === vp.scale) return vp
      const world = { x: centre.x / vp.scale + vp.ox, y: centre.y / vp.scale + vp.oy }
      return { scale: next, ox: world.x - centre.x / next, oy: world.y - centre.y / next }
    })
  }

  const segmentWidth = spec.pixels / spec.segments

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
      <button
        type="button"
        onClick={() => zoomBy(1 / 1.4)}
        className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/95 text-lg font-medium text-stone-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white"
        aria-label="Zoom out"
      >
        −
      </button>

      <div className="pointer-events-none flex flex-col items-center gap-1 rounded-lg bg-white/90 px-3 py-2 shadow-sm ring-1 ring-black/5">
        <div className="flex h-2 overflow-hidden rounded-[2px] ring-1 ring-stone-400">
          {Array.from({ length: spec.segments }, (_, i) => (
            <div
              key={i}
              style={{ width: segmentWidth }}
              className={i % 2 === 0 ? 'bg-stone-800' : 'bg-white'}
            />
          ))}
        </div>
        <div className="flex w-full justify-between text-[10px] leading-none text-stone-600 tabular-nums">
          <span>0</span>
          <span>{spec.label}</span>
        </div>
      </div>

      <div className="pointer-events-none rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] leading-none text-stone-600 shadow-sm ring-1 ring-black/5 tabular-nums">
        {formatDistance(1)} = {scale < 10 ? scale.toFixed(1) : Math.round(scale)} px
      </div>

      <button
        type="button"
        onClick={() => zoomBy(1.4)}
        className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/95 text-lg font-medium text-stone-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  )
})
