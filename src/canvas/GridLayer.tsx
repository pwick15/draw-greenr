import { memo } from 'react'
import { Layer, Shape } from 'react-konva'

import type { Rect } from '@/core/types'
import { gridSpec } from '@/core/viewport'

interface GridLayerProps {
  visible: Rect
  scale: number
  baseSize: number
}

const MINOR = 'rgba(94, 112, 96, 0.30)'
const MAJOR = 'rgba(74, 92, 76, 0.55)'
const AXIS = 'rgba(52, 74, 56, 0.75)'

/**
 * The whole grid is one Konva shape drawing one path per line weight. Three
 * `stroke()` calls per frame instead of a node per line, which matters when a
 * zoomed-out view spans a few hundred lines.
 */
export const GridLayer = memo(function GridLayer({ visible, scale, baseSize }: GridLayerProps) {
  const spec = gridSpec(scale, baseSize)

  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(context) => {
          const ctx = context._context
          const { x, y, w, h } = visible
          const x1 = x + w
          const y1 = y + h

          const drawLines = (step: number, color: string, width: number, skipMultipleOf: number | null) => {
            ctx.beginPath()
            const startX = Math.floor(x / step) * step
            for (let gx = startX; gx <= x1; gx += step) {
              if (skipMultipleOf && Math.abs(gx % skipMultipleOf) < step * 0.01) continue
              ctx.moveTo(gx, y)
              ctx.lineTo(gx, y1)
            }
            const startY = Math.floor(y / step) * step
            for (let gy = startY; gy <= y1; gy += step) {
              if (skipMultipleOf && Math.abs(gy % skipMultipleOf) < step * 0.01) continue
              ctx.moveTo(x, gy)
              ctx.lineTo(x1, gy)
            }
            ctx.strokeStyle = color
            ctx.lineWidth = width / scale
            ctx.stroke()
          }

          if (spec.minorOpacity > 0.02) {
            ctx.globalAlpha = spec.minorOpacity
            drawLines(spec.minor, MINOR, 1, spec.major)
            ctx.globalAlpha = 1
          }
          drawLines(spec.major, MAJOR, 1, null)

          // Origin cross, so "where is 0,0" is always answerable.
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(0, y1)
          ctx.moveTo(x, 0)
          ctx.lineTo(x1, 0)
          ctx.strokeStyle = AXIS
          ctx.lineWidth = 1.5 / scale
          ctx.stroke()
        }}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Layer>
  )
})
