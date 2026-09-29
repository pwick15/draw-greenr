import clsx from 'clsx'
import { useMemo, useState } from 'react'

import { loadImage } from '@/core/imageCache'
import type { AssetDef } from '@/core/types'
import { formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useEditorStore } from '@/state/editor'
import { useQuickAccessStore } from '@/state/quickAccess'

import { ASSET_DRAG_TYPE } from './AssetPanel'
import { setAssetDragImage } from './dragGhost'
import { StarIcon } from './icons'

/**
 * A rail of starred and recently used assets, pinned to the edge of the plan.
 *
 * Collapsed it is a column of thumbnails; hovering widens it to show names.
 * The point is to skip the category rail entirely — a planting plan is the
 * same dozen items placed forty times, and going back through Plants → Shrubs
 * for every one of them is most of the work.
 */
export function QuickAccessTray() {
  const [open, setOpen] = useState(false)
  const assets = useAssetStore((s) => s.assets)
  const favourites = useQuickAccessStore((s) => s.favourites)
  const recents = useQuickAccessStore((s) => s.recents)

  const resolve = useMemo(
    () => (ids: string[]) =>
      ids.map((id) => assets.get(id)).filter((a): a is AssetDef => Boolean(a)),
    [assets],
  )

  // Resolved against the live catalog every render rather than pruned on
  // delete: a custom asset that has gone simply stops appearing, and nothing
  // has to stay in sync.
  const starred = resolve(favourites)
  const recent = resolve(recents).filter((a) => !favourites.includes(a.id))

  // Rendering nothing at all was the wrong call: the tray simply was not there
  // on a fresh plan, which reads as a missing feature rather than an empty one.
  if (starred.length === 0 && recent.length === 0) {
    return (
      <div
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        className={clsx(
          'absolute left-0 top-3 z-20 overflow-hidden rounded-r-xl',
          'bg-white/95 shadow-sm ring-1 ring-stone-200 backdrop-blur transition-[width] duration-150',
          open ? 'w-[196px]' : 'w-[46px]',
        )}
      >
        <div className="flex items-center gap-2 p-2.5">
          <StarIcon size={18} className="shrink-0 text-stone-300" />
          {open && (
            <p className="text-[10px] leading-snug text-stone-400">
              Assets you place show up here. Star one to keep it.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      className={clsx(
        'absolute left-0 top-3 z-20 flex flex-col overflow-hidden rounded-r-xl',
        'bg-white/95 shadow-sm ring-1 ring-stone-200 backdrop-blur transition-[width] duration-150',
        // Capped so a long list can never reach the sidebar toggle pinned at
        // the vertical centre of the canvas.
        'max-h-[calc(50%-72px)]',
        open ? 'w-[196px]' : 'w-[46px]',
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5">
        {starred.length > 0 && (
          <Section label="Favourites" open={open}>
            {starred.map((asset) => (
              <QuickTile key={asset.id} asset={asset} open={open} starred />
            ))}
          </Section>
        )}

        {recent.length > 0 && (
          <Section label="Recent" open={open} spaced={starred.length > 0}>
            {recent.map((asset) => (
              <QuickTile key={asset.id} asset={asset} open={open} starred={false} />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({
  label,
  open,
  spaced,
  children,
}: {
  label: string
  open: boolean
  spaced?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={clsx(spaced && 'mt-2 border-t border-stone-200 pt-2')}>
      {open ? (
        <p className="px-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-stone-400">
          {label}
        </p>
      ) : (
        // Collapsed, a heading would not fit — a hairline keeps the two groups
        // legibly apart without one.
        !spaced && <span className="sr-only">{label}</span>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function QuickTile({ asset, open, starred }: { asset: AssetDef; open: boolean; starred: boolean }) {
  const thumbFor = useAssetStore((s) => s.thumbFor)
  const placing = useEditorStore((s) => s.placingAssetId === asset.id)
  const setPlacing = useEditorStore((s) => s.setPlacing)
  const toggleFavourite = useQuickAccessStore((s) => s.toggleFavourite)

  const size = `${formatDistance(asset.defaultSize.w)} × ${formatDistance(asset.defaultSize.h)}`

  return (
    <div
      className={clsx(
        'group relative flex items-center rounded-lg transition',
        placing ? 'bg-emerald-50 ring-1 ring-emerald-500' : 'hover:bg-stone-100',
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
        onPointerEnter={() => void loadImage(asset.src)}
        title={`${asset.name} — ${size}`}
        className="flex min-w-0 flex-1 items-center gap-2 p-1"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-stone-100/70">
          <img
            src={thumbFor(asset.id)}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-contain p-0.5"
          />
        </span>
        {open && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[11px] font-medium leading-tight text-stone-700">
              {asset.name}
            </span>
            <span className="block truncate text-[9px] leading-tight text-stone-400">{size}</span>
          </span>
        )}
      </button>

      {open && (
        <button
          type="button"
          onClick={() => toggleFavourite(asset.id)}
          title={starred ? `Unstar ${asset.name}` : `Star ${asset.name}`}
          aria-pressed={starred}
          className={clsx(
            'mr-1 shrink-0 rounded-md p-1 transition',
            starred
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-stone-300 opacity-0 hover:text-amber-500 group-hover:opacity-100',
          )}
        >
          <StarIcon size={14} filled={starred} />
        </button>
      )}
    </div>
  )
}
