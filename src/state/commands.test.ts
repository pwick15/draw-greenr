import { beforeEach, describe, expect, it } from 'vitest'

import type { GardenObject, SelectionRef } from '@/core/types'
import { Band } from '@/core/types'

import { duplicateObjectsInPlace, duplicateSelection } from './commands'
import { createEmptyDoc, useDocStore } from './document'
import { useEditorStore } from './editor'

const object = (patch: Partial<GardenObject> = {}): GardenObject => ({
  id: 'o1',
  assetId: 'oak',
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  rotation: 0,
  flipX: false,
  flipY: false,
  band: Band.Canopy,
  order: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  ...patch,
})

/** Load objects into a fresh document and select them. */
function seed(objects: GardenObject[]): void {
  const doc = createEmptyDoc()
  doc.objects = Object.fromEntries(objects.map((o) => [o.id, o]))
  useDocStore.getState().resetDoc(doc)
  useEditorStore.getState().select(objects.map((o): SelectionRef => ({ kind: 'object', id: o.id })))
  useEditorStore.getState().setRepeatOffset(null)
}

const selectedIds = (): string[] =>
  useEditorStore.getState().selection.filter((r) => r.kind === 'object').map((r) => r.id)

const xs = (): number[] =>
  Object.values(useDocStore.getState().doc.objects)
    .map((o) => o.x)
    .sort((a, b) => a - b)

describe('duplicateSelection', () => {
  beforeEach(() => {
    useEditorStore.getState().setRepeatOffset(null)
  })

  it('places the copy flush against the original with no gap', () => {
    seed([object({ id: 'a', x: 0, w: 2 })])
    duplicateSelection()
    expect(xs()).toEqual([0, 2])
  })

  it('selects the copy rather than the original', () => {
    seed([object({ id: 'a' })])
    duplicateSelection()
    const ids = selectedIds()
    expect(ids).toHaveLength(1)
    expect(ids[0]).not.toBe('a')
  })

  it('builds a continuous row when repeated', () => {
    seed([object({ id: 'a', x: 0, w: 2 })])
    duplicateSelection()
    duplicateSelection()
    duplicateSelection()
    // Butting up against each other, not stacking on the same spot.
    expect(xs()).toEqual([0, 2, 4, 6])
  })

  it('offsets a multi-object selection by the whole group width', () => {
    seed([object({ id: 'a', x: 0, w: 2 }), object({ id: 'b', x: 3, w: 2 })])
    // The group spans x -1..4, so it is 5 metres wide.
    duplicateSelection()
    expect(xs()).toEqual([0, 3, 5, 8])
  })

  it('is one undo step no matter how many objects it copied', () => {
    seed([object({ id: 'a' }), object({ id: 'b', x: 5 })])
    const before = useDocStore.getState().past.length
    duplicateSelection()
    expect(useDocStore.getState().past.length).toBe(before + 1)
  })
})

describe('repeat offset', () => {
  it('repeats a remembered offset instead of the default', () => {
    seed([object({ id: 'a', x: 0, w: 2 })])
    // What a ⌘-drag of 5 m would have left behind.
    useEditorStore.getState().setRepeatOffset({ ids: ['a'], delta: { x: 5, y: 0 } })

    duplicateSelection()
    expect(xs()).toEqual([0, 5])
  })

  it('keeps stepping by that offset on every repeat', () => {
    seed([object({ id: 'a', x: 0, w: 2 })])
    useEditorStore.getState().setRepeatOffset({ ids: ['a'], delta: { x: 5, y: 0 } })

    duplicateSelection()
    duplicateSelection()
    duplicateSelection()
    expect(xs()).toEqual([0, 5, 10, 15])
  })

  it('carries a diagonal offset through, not just a horizontal one', () => {
    seed([object({ id: 'a', x: 0, y: 0 })])
    useEditorStore.getState().setRepeatOffset({ ids: ['a'], delta: { x: 1, y: 3 } })
    duplicateSelection()
    duplicateSelection()
    const ys = Object.values(useDocStore.getState().doc.objects)
      .map((o) => o.y)
      .sort((a, b) => a - b)
    expect(ys).toEqual([0, 3, 6])
  })

  it('ignores an offset remembered for different objects', () => {
    seed([object({ id: 'a', x: 0, w: 2 })])
    // Left over from a drag of something else entirely.
    useEditorStore.getState().setRepeatOffset({ ids: ['someone-else'], delta: { x: 5, y: 0 } })

    duplicateSelection()
    // Falls back to flush-right rather than repeating an unrelated step.
    expect(xs()).toEqual([0, 2])
  })
})

describe('duplicateObjectsInPlace', () => {
  it('copies at the same coordinates under new ids', () => {
    seed([object({ id: 'a', x: 4, y: 7 })])
    useDocStore.getState().begin('Duplicate')
    const copies = duplicateObjectsInPlace([useDocStore.getState().doc.objects.a])
    useDocStore.getState().end()

    expect(copies).toHaveLength(1)
    expect(copies[0].id).not.toBe('a')
    expect(copies[0].x).toBe(4)
    expect(copies[0].y).toBe(7)
  })

  it('collapses into the surrounding transaction, so the drag is one undo', () => {
    seed([object({ id: 'a' })])
    const before = useDocStore.getState().past.length

    useDocStore.getState().begin('Duplicate')
    const copies = duplicateObjectsInPlace([useDocStore.getState().doc.objects.a])
    // The move half of the gesture.
    useDocStore.getState().update((draft) => {
      draft.objects[copies[0].id].x = 9
    })
    useDocStore.getState().end()

    expect(useDocStore.getState().past.length).toBe(before + 1)
    expect(useDocStore.getState().past.at(-1)!.label).toBe('Duplicate')
  })

  it('leaves the original where it was', () => {
    seed([object({ id: 'a', x: 4 })])
    useDocStore.getState().begin('Duplicate')
    const copies = duplicateObjectsInPlace([useDocStore.getState().doc.objects.a])
    useDocStore.getState().update((draft) => {
      draft.objects[copies[0].id].x = 40
    })
    useDocStore.getState().end()

    expect(useDocStore.getState().doc.objects.a.x).toBe(4)
  })

  it('stacks the copy above the original in its band', () => {
    seed([object({ id: 'a', order: 0 })])
    useDocStore.getState().begin('Duplicate')
    const copies = duplicateObjectsInPlace([useDocStore.getState().doc.objects.a])
    useDocStore.getState().end()
    expect(copies[0].order).toBeGreaterThan(0)
  })

  it('selects the copies so the drag moves them and not the originals', () => {
    seed([object({ id: 'a' })])
    useDocStore.getState().begin('Duplicate')
    const copies = duplicateObjectsInPlace([useDocStore.getState().doc.objects.a])
    useDocStore.getState().end()
    expect(selectedIds()).toEqual([copies[0].id])
  })
})
