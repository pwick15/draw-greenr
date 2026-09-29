import type { AssetDef } from '@/core/types'
import { useEditorStore } from '@/state/editor'

/**
 * The image that follows the cursor while dragging an asset onto the plan.
 *
 * Left to itself the browser drags a snapshot of whatever was grabbed — a
 * whole tray row, name and dimensions included — which is neither the shape
 * nor the size of the thing being placed. Building the ghost by hand instead
 * gives the artwork at its true on-plan size, with its transparency intact, so
 * the drag matches what lands on release.
 */

/** Never shrink below this, or a small plant becomes an invisible cursor. */
const MIN_PX = 24
/** Never exceed this: a mature oak at close zoom would fill the window. */
const MAX_PX = 320

const clamp = (v: number): number => Math.max(MIN_PX, Math.min(MAX_PX, v))

export function setAssetDragImage(event: React.DragEvent, asset: AssetDef): void {
  const { scale } = useEditorStore.getState().viewport
  const { w, h } = asset.defaultSize
  // Keep the aspect ratio when clamping, so nothing is squashed.
  const factor = Math.min(clamp(w * scale) / (w * scale), clamp(h * scale) / (h * scale))
  const width = w * scale * factor
  const height = h * scale * factor

  const ghost = document.createElement('img')
  ghost.src = asset.src
  ghost.width = Math.round(width)
  ghost.height = Math.round(height)
  // Off-screen rather than hidden: the browser has to be able to paint it, so
  // display:none or visibility:hidden would give an empty drag image.
  ghost.style.position = 'fixed'
  ghost.style.top = '-10000px'
  ghost.style.left = '-10000px'
  ghost.style.pointerEvents = 'none'
  document.body.append(ghost)

  event.dataTransfer.setDragImage(ghost, width / 2, height / 2)
  // The snapshot is taken synchronously during dragstart, so the element can
  // go as soon as this turn of the event loop is over.
  setTimeout(() => ghost.remove(), 0)
}
