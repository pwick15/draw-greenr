import { useEffect } from 'react'

import { copySelection, cutSelection, pasteClipboard } from '@/state/clipboard'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'
import {
  deleteSelection,
  duplicateSelection,
  flipSelection,
  nudgeSelection,
  reorderSelection,
  rotateSelection,
  selectAll,
  selectSameAsset,
  setSelectionLocked,
  zoomToFit,
  zoomToSelection,
} from '@/state/commands'

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** Small nudge, or a larger one with Shift. */
const NUDGE = 0.1
const NUDGE_BIG = 1

export function useKeyboardShortcuts(onCommitPlot: () => void, onCancelPlot: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTextTarget(event.target)) return
      const editor = useEditorStore.getState()
      const doc = useDocStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const step = event.shiftKey ? NUDGE_BIG : NUDGE

      // --- plot tool owns a few keys while it is drawing ---
      if (editor.tool === 'plot' && editor.plotDraft.length > 0) {
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommitPlot()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancelPlot()
          return
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault()
          editor.popPlotPoint()
          return
        }
      }

      if (mod) {
        switch (event.key.toLowerCase()) {
          case 'z':
            event.preventDefault()
            if (event.shiftKey) doc.redo()
            else doc.undo()
            return
          case 'y':
            event.preventDefault()
            doc.redo()
            return
          case 'a':
            event.preventDefault()
            selectAll()
            return
          case 'd':
            event.preventDefault()
            duplicateSelection()
            return
          case 'c':
            event.preventDefault()
            copySelection()
            return
          case 'x':
            event.preventDefault()
            cutSelection()
            return
          case 'v':
            event.preventDefault()
            pasteClipboard()
            return
          case 'l':
            event.preventDefault()
            setSelectionLocked(!event.shiftKey)
            return
          case ']':
            event.preventDefault()
            reorderSelection(event.shiftKey ? 'front' : 'forward')
            return
          case '[':
            event.preventDefault()
            reorderSelection(event.shiftKey ? 'back' : 'backward')
            return
          case '0':
            event.preventDefault()
            zoomToFit()
            return
          default:
            return
        }
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          if (editor.placingAssetId) editor.setPlacing(null)
          else if (editor.isolatedBand !== null) editor.setIsolatedBand(null)
          else editor.clearSelection()
          return
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          deleteSelection()
          return
        case 'ArrowLeft':
          event.preventDefault()
          nudgeSelection(-step, 0)
          return
        case 'ArrowRight':
          event.preventDefault()
          nudgeSelection(step, 0)
          return
        case 'ArrowUp':
          event.preventDefault()
          nudgeSelection(0, -step)
          return
        case 'ArrowDown':
          event.preventDefault()
          nudgeSelection(0, step)
          return
        default:
          break
      }

      // Unmodified brackets fold the sidebars; the Cmd-modified pair is
      // already spoken for by stacking order.
      if (event.key === '[') {
        event.preventDefault()
        editor.toggle('showLeftPanel')
        return
      }
      if (event.key === ']') {
        event.preventDefault()
        editor.toggle('showRightPanel')
        return
      }

      switch (event.key.toLowerCase()) {
        case 'v':
          editor.setTool('select')
          break
        case 'h':
          editor.setTool('pan')
          break
        case 'p':
          editor.setTool('plot')
          break
        case 'm':
          editor.setTool('measure')
          break
        case 'g':
          editor.toggle('snapToGrid')
          break
        case "'":
          editor.toggle('showGrid')
          break
        case 'f':
          if (editor.selection.length) zoomToSelection()
          else zoomToFit()
          break
        case 'r':
          rotateSelection(event.shiftKey ? -15 : 15)
          break
        case 'x':
          flipSelection('x')
          break
        case 'y':
          flipSelection('y')
          break
        case 's':
          selectSameAsset()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCommitPlot, onCancelPlot])
}
