import { useState } from 'react'

import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'
import {
  deleteSelection,
  duplicateSelection,
  zoomToFit,
} from '@/state/commands'
import { exportDocJson, exportPng, importDocJson } from '@/state/persistence'

import {
  CopyIcon,
  CursorIcon,
  DownloadIcon,
  GridIcon,
  HandIcon,
  ImageIcon,
  MagnetIcon,
  PlotIcon,
  RedoIcon,
  RulerIcon,
  SaveIcon,
  TargetIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from './icons'
import { Button, ToolButton } from './primitives'

const TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: CursorIcon },
  { id: 'pan', label: 'Pan', shortcut: 'H  ·  or hold Space', Icon: HandIcon },
  { id: 'plot', label: 'Draw plot', shortcut: 'P', Icon: PlotIcon },
  { id: 'measure', label: 'Measure', shortcut: 'M', Icon: RulerIcon },
] as const

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const showGrid = useEditorStore((s) => s.showGrid)
  const toggle = useEditorStore((s) => s.toggle)
  const selection = useEditorStore((s) => s.selection)

  const doc = useDocStore((s) => s.doc)
  const past = useDocStore((s) => s.past)
  const future = useDocStore((s) => s.future)
  const undo = useDocStore((s) => s.undo)
  const redo = useDocStore((s) => s.redo)
  const apply = useDocStore((s) => s.apply)

  const [busy, setBusy] = useState(false)

  const handleExportPng = async () => {
    setBusy(true)
    try {
      await exportPng()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File) => {
    try {
      await importDocJson(file)
      zoomToFit()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not open that file.')
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3">
      <div className="flex items-center gap-2 pr-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          G
        </span>
        <input
          value={doc.name}
          onChange={(e) => {
            const name = e.target.value
            apply('Rename plan', (draft) => {
              draft.name = name
            })
          }}
          aria-label="Plan name"
          className="w-44 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium text-stone-800 outline-none transition hover:border-stone-200 focus:border-emerald-500 focus:bg-white"
        />
      </div>

      <div className="mx-1 h-7 w-px bg-stone-200" />

      <div className="flex items-center gap-0.5">
        {TOOLS.map(({ id, label, shortcut, Icon }) => (
          <ToolButton
            key={id}
            label={label}
            shortcut={shortcut}
            active={tool === id}
            onClick={() => setTool(id)}
          >
            <Icon />
          </ToolButton>
        ))}
      </div>

      <div className="mx-1 h-7 w-px bg-stone-200" />

      <div className="flex items-center gap-0.5">
        <ToolButton label="Undo" shortcut="⌘Z" disabled={past.length === 0} onClick={undo}>
          <UndoIcon />
        </ToolButton>
        <ToolButton label="Redo" shortcut="⇧⌘Z" disabled={future.length === 0} onClick={redo}>
          <RedoIcon />
        </ToolButton>
        <ToolButton
          label="Duplicate"
          shortcut="⌘D"
          disabled={selection.length === 0}
          onClick={duplicateSelection}
        >
          <CopyIcon />
        </ToolButton>
        <ToolButton
          label="Delete"
          shortcut="Delete"
          disabled={selection.length === 0}
          onClick={deleteSelection}
        >
          <TrashIcon />
        </ToolButton>
      </div>

      <div className="mx-1 h-7 w-px bg-stone-200" />

      <div className="flex items-center gap-0.5">
        <ToolButton label="Show grid" shortcut="'" active={showGrid} onClick={() => toggle('showGrid')}>
          <GridIcon />
        </ToolButton>
        <ToolButton
          label="Snap to grid"
          shortcut="G"
          active={snapToGrid}
          onClick={() => toggle('snapToGrid')}
        >
          <MagnetIcon />
        </ToolButton>
        <ToolButton label="Zoom to fit" shortcut="⌘0" onClick={zoomToFit}>
          <TargetIcon />
        </ToolButton>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <label
          title="Open a .greenr plan"
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        >
          <UploadIcon size={16} />
          <input
            type="file"
            accept=".greenr,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleImport(file)
            }}
          />
        </label>
        <Button size="sm" variant="ghost" onClick={exportDocJson} title="Download this plan as a file">
          <SaveIcon size={16} />
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void handleExportPng()}>
          {busy ? (
            <>
              <ImageIcon size={16} /> Exporting…
            </>
          ) : (
            <>
              <DownloadIcon size={16} /> Export PNG
            </>
          )}
        </Button>
      </div>
    </header>
  )
}
