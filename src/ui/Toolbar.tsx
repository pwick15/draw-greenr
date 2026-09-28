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
  CubeIcon,
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
import { PlansMenu } from './PlansMenu'
import { Button, ToolButton } from './primitives'

const TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: CursorIcon },
  { id: 'pan', label: 'Pan', shortcut: 'H  ·  or hold Space', Icon: HandIcon },
  { id: 'plot', label: 'Draw plot', shortcut: 'P', Icon: PlotIcon },
  { id: 'measure', label: 'Measure', shortcut: 'M', Icon: RulerIcon },
] as const

export function Toolbar({ onOpenIso }: { onOpenIso: () => void }) {
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
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-600"
          title="Draw Greenr"
        >
          <svg width="20" height="20" viewBox="0 0 64 64" aria-label="Draw Greenr" role="img">
            <path d="M17 47C17 30 29 17 47 17c0 18-13 30-30 30Z" fill="#eaf6ef" />
            <path
              d="M17 47C25 39 34 30 47 17"
              stroke="#1f8f5f"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
        {/* Wordmark only where there is room; the toolbar is dense already. */}
        <span className="hidden shrink-0 text-sm font-semibold tracking-tight text-stone-800 xl:block">
          Draw Greenr
        </span>
        <span className="hidden h-5 w-px shrink-0 bg-stone-200 xl:block" />
        <input
          value={doc.name}
          onChange={(e) => {
            const name = e.target.value
            apply('Rename plan', (draft) => {
              draft.name = name
            })
          }}
          aria-label="Plan name"
          className="w-36 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium text-stone-800 outline-none transition hover:border-stone-200 focus:border-emerald-500 focus:bg-white"
        />
        <PlansMenu />
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
        <Button size="sm" onClick={onOpenIso} title="See this plan in 3D">
          <CubeIcon size={16} /> 3D
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
