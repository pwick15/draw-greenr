import clsx from 'clsx'
import { useMemo, useState } from 'react'

import { loadImage } from '@/core/imageCache'
import type { AssetDef } from '@/core/types'
import { formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useEditorStore } from '@/state/editor'
import { useQuickAccessStore } from '@/state/quickAccess'

import { CATEGORY_ICONS } from './categoryIcons'
import { setAssetDragImage } from './dragGhost'
import { PlotIcon, StarIcon, UploadIcon } from './icons'
import { Button, EmptyState, Panel, TextInput } from './primitives'
import { PlotPalette } from './PlotPalette'
import { MyAssetsPanel } from './MyAssetsPanel'

export const ASSET_DRAG_TYPE = 'application/x-greenr-asset'

const PLOT_TAB = '__plot__'
const CUSTOM_TAB = '__custom__'

export function AssetPanel({ onImport }: { onImport: () => void }) {
  const categories = useAssetStore((s) => s.categories)
  const assets = useAssetStore((s) => s.assets)
  const activeCategory = useEditorStore((s) => s.assetPanelCategory)
  const setCategory = useEditorStore((s) => s.setAssetPanelCategory)
  const [query, setQuery] = useState('')

  const customCount = useMemo(
    () => [...assets.values()].filter((a) => a.source === 'custom').length,
    [assets],
  )

  const visible = useMemo(() => {
    const list = [...assets.values()]
    const q = query.trim().toLowerCase()
    if (q) {
      return list
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.tags.some((t) => t.includes(q)) ||
            a.category.includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    if (activeCategory === CUSTOM_TAB) {
      return list.filter((a) => a.source === 'custom').sort((a, b) => a.name.localeCompare(b.name))
    }
    return list.filter((a) => a.category === activeCategory)
  }, [assets, activeCategory, query])

  const searching = query.trim().length > 0
  const showPlot = activeCategory === PLOT_TAB && !searching
  const showCustom = activeCategory === CUSTOM_TAB && !searching

  return (
    <div className="flex h-full min-h-0">
      {/* Category rail. */}
      <nav className="flex w-[62px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-stone-200 bg-stone-50 py-2">
        <RailButton
          active={activeCategory === PLOT_TAB}
          label="Plot"
          onClick={() => setCategory(PLOT_TAB)}
        >
          <PlotIcon size={20} />
        </RailButton>
        <div className="my-1 h-px w-8 bg-stone-200" />
        {categories.map((category) => {
          const Glyph = CATEGORY_ICONS[category.icon]
          return (
            <RailButton
              key={category.id}
              active={activeCategory === category.id}
              label={category.name}
              onClick={() => setCategory(category.id)}
            >
              {Glyph ? <Glyph size={20} /> : <span className="text-xs">{category.name[0]}</span>}
            </RailButton>
          )
        })}
        <div className="my-1 h-px w-8 bg-stone-200" />
        <RailButton
          active={activeCategory === CUSTOM_TAB}
          label="My assets"
          onClick={() => setCategory(CUSTOM_TAB)}
          badge={customCount || undefined}
        >
          <UploadIcon size={20} />
        </RailButton>
      </nav>

      {/* Content. */}
      <div className="flex min-h-0 w-[268px] flex-col bg-white">
        <div className="shrink-0 px-3 pb-2 pt-3">
          <TextInput
            placeholder="Search all assets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {showPlot ? (
          <PlotPalette />
        ) : showCustom ? (
          <MyAssetsPanel onImport={onImport} />
        ) : (
          <Panel
            title={
              searching
                ? `${visible.length} result${visible.length === 1 ? '' : 's'}`
                : (categories.find((c) => c.id === activeCategory)?.name ?? 'Assets')
            }
            className="min-h-0 flex-1"
          >
            {visible.length === 0 ? (
              <EmptyState
                title={searching ? 'Nothing matched' : 'Nothing here yet'}
                hint={searching ? 'Try a shorter search term.' : undefined}
                action={
                  !searching ? (
                    <Button size="sm" onClick={onImport} className="mt-2">
                      <UploadIcon size={14} /> Import an asset
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto px-3 pb-3">
                {visible.map((asset) => (
                  <AssetTile key={asset.id} asset={asset} />
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function RailButton({
  active,
  label,
  onClick,
  badge,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={clsx(
        'relative flex w-[54px] flex-col items-center gap-1 rounded-lg px-1 py-2 transition',
        active ? 'bg-emerald-600/10 text-emerald-700' : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-800',
      )}
    >
      {children}
      <span className="w-full truncate text-center text-[9px] font-medium leading-tight">{label}</span>
      {badge !== undefined && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------

export function AssetTile({ asset }: { asset: AssetDef }) {
  const thumbFor = useAssetStore((s) => s.thumbFor)
  const placing = useEditorStore((s) => s.placingAssetId === asset.id)
  const setPlacing = useEditorStore((s) => s.setPlacing)
  const starred = useQuickAccessStore((s) => s.favourites.includes(asset.id))
  const toggleFavourite = useQuickAccessStore((s) => s.toggleFavourite)

  return (
    // The star is its own control, so it cannot live inside the tile's button.
    <div
      className={clsx(
        'group relative flex flex-col rounded-lg border transition',
        placing
          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
          : 'border-transparent hover:border-stone-200 hover:bg-stone-50',
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id)
          e.dataTransfer.effectAllowed = 'copy'
          setAssetDragImage(e, asset)
        }}
        onClick={() => setPlacing(placing ? null : asset.id)}
        // Decode on hover so the placement preview is there the instant it is
        // clicked. This also builds the alpha mask, which picking wants as soon
        // as the object lands.
        onPointerEnter={() => void loadImage(asset.src)}
        title={`${asset.name} — ${formatDistance(asset.defaultSize.w)} × ${formatDistance(asset.defaultSize.h)}`}
        className="flex flex-col items-center gap-1 p-1.5"
      >
        <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-stone-100/70">
          <img
            src={thumbFor(asset.id)}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-contain p-1"
          />
        </span>
        <span className="w-full truncate text-center text-[10px] leading-tight text-stone-600 group-hover:text-stone-900">
          {asset.name}
        </span>
      </button>

      <button
        type="button"
        onClick={() => toggleFavourite(asset.id)}
        title={starred ? `Remove ${asset.name} from favourites` : `Add ${asset.name} to favourites`}
        aria-pressed={starred}
        className={clsx(
          'absolute right-0.5 top-0.5 rounded-md p-0.5 transition',
          starred
            ? 'text-amber-500 hover:text-amber-600'
            : 'text-stone-300 opacity-0 hover:text-amber-500 focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <StarIcon size={13} filled={starred} />
      </button>
    </div>
  )
}
