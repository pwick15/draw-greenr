import clsx from 'clsx'
import { useCallback, useEffect, useState } from 'react'

import { PlanCanvas } from '@/canvas/PlanCanvas'
import { useAssetStore } from '@/state/assets'
import { useEditorStore } from '@/state/editor'
import { restoreLastDoc, useAutosave } from '@/state/persistence'
import { AssetPanel } from '@/ui/AssetPanel'
import { ImportAssetDialog } from '@/ui/ImportAssetDialog'
import { Inspector } from '@/ui/Inspector'
import { LayersPanel } from '@/ui/LayersPanel'
import { SidebarToggle } from '@/ui/SidebarToggle'
import { Toolbar } from '@/ui/Toolbar'

export default function App() {
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [restored, setRestored] = useState(false)

  const showLeft = useEditorStore((s) => s.showLeftPanel)
  const showRight = useEditorStore((s) => s.showRightPanel)
  const toggle = useEditorStore((s) => s.toggle)

  useAutosave()

  useEffect(() => {
    void (async () => {
      await useAssetStore.getState().load()
      await restoreLastDoc()
      setRestored(true)
    })()
  }, [])

  const openImport = useCallback((file?: File) => {
    setDroppedFile(file ?? null)
    setImportOpen(true)
  }, [])

  const closeImport = useCallback(() => {
    setImportOpen(false)
    setDroppedFile(null)
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-stone-100 text-stone-900">
      <Toolbar />

      <div className="flex min-h-0 flex-1">
        {/* Collapsed panels are unmounted rather than hidden: the asset grid
            and layer tree have real render cost, and neither is doing anything
            useful off-screen. */}
        <aside
          className={clsx(
            'flex shrink-0 overflow-hidden border-r border-stone-200 bg-white transition-[width] duration-150',
            showLeft ? 'w-[330px]' : 'w-0 border-r-0',
          )}
        >
          {showLeft && <AssetPanel onImport={() => openImport()} />}
        </aside>

        <main className="relative min-w-0 flex-1">
          {restored && <PlanCanvas onFileDropped={openImport} />}
          <SidebarToggle
            side="left"
            open={showLeft}
            onToggle={() => toggle('showLeftPanel')}
            label="the asset library"
          />
          <SidebarToggle
            side="right"
            open={showRight}
            onToggle={() => toggle('showRightPanel')}
            label="layers and properties"
          />
        </main>

        <aside
          className={clsx(
            'flex shrink-0 flex-col divide-y divide-stone-200 overflow-hidden border-l border-stone-200 bg-white transition-[width] duration-150',
            showRight ? 'w-[268px]' : 'w-0 border-l-0',
          )}
        >
          {showRight && (
            <>
              <LayersPanel />
              <div className="max-h-[52%] shrink-0 overflow-y-auto">
                <Inspector />
              </div>
            </>
          )}
        </aside>
      </div>

      <ImportAssetDialog open={importOpen} onClose={closeImport} initialFile={droppedFile} />
    </div>
  )
}
