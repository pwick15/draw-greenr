import { selectionBounds } from '@/core/transform'
import type { GardenObject, SelectionRef } from '@/core/types'

import { newId, topOfBand, useDocStore } from './document'
import { useEditorStore } from './editor'

/**
 * In-memory clipboard.
 *
 * Deliberately not the system clipboard: these are document objects, not text,
 * and reading the system clipboard needs a permission prompt that would fire on
 * every paste. The trade-off is that copy/paste does not cross tabs, which for
 * a single-window planner is not a real loss.
 */
let buffer: GardenObject[] = []

export const clipboardSize = (): number => buffer.length

const selectedObjects = (): GardenObject[] => {
  const { doc } = useDocStore.getState()
  return useEditorStore
    .getState()
    .selection.filter((r) => r.kind === 'object')
    .map((r) => doc.objects[r.id])
    .filter((o): o is GardenObject => Boolean(o))
}

export function copySelection(): number {
  const objects = selectedObjects()
  if (objects.length === 0) return 0
  buffer = objects.map((o) => ({ ...o }))
  return buffer.length
}

export function cutSelection(): number {
  const count = copySelection()
  if (count === 0) return 0
  const ids = buffer.map((o) => o.id)
  useDocStore.getState().apply('Cut', (draft) => {
    for (const id of ids) {
      if (!draft.objects[id]?.locked) delete draft.objects[id]
    }
  })
  useEditorStore.getState().clearSelection()
  return count
}

/**
 * Paste flush against the right-hand edge of whatever was copied, with no gap.
 *
 * Because the pasted objects become the new selection, pressing paste again
 * offsets from *them* — so repeated pastes lay out a continuous row, which is
 * the point: a hedge or a run of paving is built by repeating one unit.
 */
export function pasteClipboard(): number {
  if (buffer.length === 0) return 0

  // Offset by the source group's own width so copies butt up against it,
  // regardless of how the group is arranged internally.
  const bounds = selectionBounds(buffer)
  const dx = bounds?.w ?? 0

  const created: SelectionRef[] = []
  useDocStore.getState().apply(buffer.length > 1 ? `Paste ${buffer.length} items` : 'Paste', (draft) => {
    for (const source of buffer) {
      const copy: GardenObject = {
        ...source,
        id: newId('obj'),
        x: source.x + dx,
        y: source.y,
        order: topOfBand(draft, source.band),
      }
      draft.objects[copy.id] = copy
      created.push({ kind: 'object', id: copy.id })
    }
  })

  // Advance the buffer so the next paste continues the row rather than
  // stacking a second copy on the first.
  const { doc } = useDocStore.getState()
  buffer = created
    .map((ref) => doc.objects[ref.id])
    .filter((o): o is GardenObject => Boolean(o))
    .map((o) => ({ ...o }))

  useEditorStore.getState().select(created)
  return created.length
}

/** Paste a copy at a specific point, used by paste-at-cursor. */
export function pasteAt(x: number, y: number): number {
  if (buffer.length === 0) return 0
  const bounds = selectionBounds(buffer)
  if (!bounds) return 0
  const dx = x - (bounds.x + bounds.w / 2)
  const dy = y - (bounds.y + bounds.h / 2)

  const created: SelectionRef[] = []
  useDocStore.getState().apply('Paste', (draft) => {
    for (const source of buffer) {
      const copy: GardenObject = {
        ...source,
        id: newId('obj'),
        x: source.x + dx,
        y: source.y + dy,
        order: topOfBand(draft, source.band),
      }
      draft.objects[copy.id] = copy
      created.push({ kind: 'object', id: copy.id })
    }
  })
  useEditorStore.getState().select(created)
  return created.length
}
