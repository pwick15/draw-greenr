import { useMemo, useState } from 'react'

import { BAND_META } from '@/core/types'
import { formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { exportAssetPack, importAssetPack } from '@/state/assetPack'

import { AssetTile } from './AssetPanel'
import { DownloadIcon, TrashIcon, UploadIcon } from './icons'
import { Button, EmptyState, Panel } from './primitives'

export function MyAssetsPanel({ onImport }: { onImport: () => void }) {
  const assets = useAssetStore((s) => s.assets)
  const removeAsset = useAssetStore((s) => s.removeAsset)
  const doc = useDocStore((s) => s.doc)
  const [busy, setBusy] = useState<string | null>(null)

  const custom = useMemo(
    () => [...assets.values()].filter((a) => a.source === 'custom').sort((a, b) => a.name.localeCompare(b.name)),
    [assets],
  )

  /** Refuse to silently break a plan that is already using the asset. */
  const usageCount = (assetId: string) =>
    Object.values(doc.objects).filter((o) => o.assetId === assetId).length

  const handleDelete = async (id: string, name: string) => {
    const uses = usageCount(id)
    const message = uses
      ? `"${name}" is used ${uses} time${uses === 1 ? '' : 's'} in this plan. Those objects will lose their artwork. Delete anyway?`
      : `Delete "${name}"?`
    if (!window.confirm(message)) return
    await removeAsset(id)
  }

  const handleExport = async () => {
    setBusy('export')
    try {
      await exportAssetPack(custom.map((a) => a.id))
    } finally {
      setBusy(null)
    }
  }

  const handleImportPack = async (file: File) => {
    setBusy('import')
    try {
      const count = await importAssetPack(file)
      window.alert(`Imported ${count} asset${count === 1 ? '' : 's'}.`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not read that pack.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel title="My assets" className="min-h-0 flex-1">
      <div className="flex shrink-0 gap-1.5 px-3 pb-2">
        <Button size="sm" variant="primary" onClick={onImport} className="flex-1">
          <UploadIcon size={14} /> Add asset
        </Button>
        <label
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-300 transition hover:bg-stone-50"
          title="Import an asset pack (.greenrpack)"
        >
          <UploadIcon size={14} />
          <input
            type="file"
            accept=".greenrpack,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleImportPack(file)
            }}
          />
        </label>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={custom.length === 0 || busy !== null}
          title="Export all custom assets as a pack"
        >
          <DownloadIcon size={14} />
        </Button>
      </div>

      {custom.length === 0 ? (
        <EmptyState
          title="No custom assets yet"
          hint="Drop in a PNG, SVG or photo and it behaves exactly like a built-in: scaled in metres, alpha-accurate to click, and stacked in the right layer."
          action={
            <Button size="sm" variant="primary" onClick={onImport} className="mt-2">
              <UploadIcon size={14} /> Import your first
            </Button>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {custom.map((asset) => (
              <div key={asset.id} className="group relative">
                <AssetTile asset={asset} />
                <button
                  type="button"
                  onClick={() => void handleDelete(asset.id, asset.name)}
                  title={`Delete ${asset.name}`}
                  aria-label={`Delete ${asset.name}`}
                  className="absolute right-0.5 top-0.5 hidden h-5 w-5 place-items-center rounded-md bg-white/95 text-stone-400 shadow-sm ring-1 ring-stone-200 transition hover:text-rose-600 group-hover:grid"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>

          <ul className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-[10px] text-stone-400">
            {custom.slice(0, 6).map((asset) => (
              <li key={asset.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate text-stone-500">{asset.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatDistance(asset.defaultSize.w)} · {BAND_META[asset.band].name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
