import clsx from 'clsx'
import { useMemo, useState } from 'react'

import { multiPolyArea } from '@/core/geometry'
import { BAND_META, BAND_ORDER, Band, type BandId } from '@/core/types'
import { formatArea } from '@/core/viewport'
import { getAsset, useAssetStore } from '@/state/assets'
import { objectsInBand, useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'

import { ChevronIcon, EyeIcon, EyeOffIcon, LockIcon, TargetIcon, UnlockIcon } from './icons'
import { Panel } from './primitives'

/**
 * Bands, not a flat layer list.
 *
 * A hundred objects in one list is unusable — you scroll looking for "the third
 * shrub". Grouping by what a thing *is* means the list stays about eight rows
 * long at the top level, and the per-band eye / lock / isolate controls are
 * what stop a big lawn or a house plan from swallowing every click.
 */
export function LayersPanel() {
  const doc = useDocStore((s) => s.doc)
  const assets = useAssetStore((s) => s.assets)
  const materials = useAssetStore((s) => s.materials)

  const selection = useEditorStore((s) => s.selection)
  const select = useEditorStore((s) => s.select)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
  const hiddenBands = useEditorStore((s) => s.hiddenBands)
  const lockedBands = useEditorStore((s) => s.lockedBands)
  const isolatedBand = useEditorStore((s) => s.isolatedBand)
  const toggleBandHidden = useEditorStore((s) => s.toggleBandHidden)
  const toggleBandLocked = useEditorStore((s) => s.toggleBandLocked)
  const setIsolatedBand = useEditorStore((s) => s.setIsolatedBand)
  const setHover = useEditorStore((s) => s.setHover)

  const [expanded, setExpanded] = useState<BandId[]>([])

  const counts = useMemo(() => {
    const map = new Map<BandId, number>()
    for (const object of Object.values(doc.objects)) {
      map.set(object.band, (map.get(object.band) ?? 0) + 1)
    }
    map.set(Band.Terrain, doc.surfaces.length)
    return map
  }, [doc.objects, doc.surfaces])

  const selectedIds = new Set(selection.map((r) => r.id))

  // Highest band draws on top, so show it at the top of the list.
  const ordered = [...BAND_ORDER].reverse()

  return (
    <Panel
      title="Layers"
      action={
        isolatedBand !== null ? (
          <button
            type="button"
            onClick={() => setIsolatedBand(null)}
            className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-600/20"
          >
            Exit isolation
          </button>
        ) : undefined
      }
      className="min-h-0 flex-1"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {ordered.map((band) => {
          const meta = BAND_META[band]
          const count = counts.get(band) ?? 0
          const hidden = hiddenBands.includes(band)
          const locked = lockedBands.includes(band)
          const isolated = isolatedBand === band
          const isOpen = expanded.includes(band)
          const objects = isOpen && band !== Band.Terrain ? objectsInBand(doc, band) : []

          return (
            <div
              key={band}
              className={clsx(
                'mb-0.5 rounded-lg transition',
                isolated && 'bg-emerald-600/8 ring-1 ring-emerald-600/25',
              )}
            >
              <div
                className={clsx(
                  'group flex items-center gap-1 rounded-lg px-1 py-1 transition hover:bg-stone-100',
                  hidden && 'opacity-45',
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(band) ? current.filter((b) => b !== band) : [...current, band],
                    )
                  }
                  disabled={count === 0 || band === Band.Terrain}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-stone-400 transition disabled:opacity-0"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  <ChevronIcon size={13} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (band === Band.Terrain) {
                      select(doc.surfaces.map((s) => ({ kind: 'surface' as const, id: s.id })))
                    } else {
                      select(objectsInBand(doc, band).map((o) => ({ kind: 'object' as const, id: o.id })))
                    }
                  }}
                  title={meta.hint}
                  className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                >
                  <span className="truncate text-xs font-medium text-stone-700">{meta.name}</span>
                  <span className="shrink-0 text-[10px] text-stone-400 tabular-nums">{count || ''}</span>
                </button>

                <IconToggle
                  active={isolated}
                  onClick={() => setIsolatedBand(isolated ? null : band)}
                  label={isolated ? 'Stop isolating this layer' : 'Edit only this layer'}
                >
                  <TargetIcon size={13} />
                </IconToggle>
                <IconToggle
                  active={locked}
                  onClick={() => toggleBandLocked(band)}
                  label={locked ? 'Unlock layer' : 'Lock layer — visible but not clickable'}
                >
                  {locked ? <LockIcon size={13} /> : <UnlockIcon size={13} />}
                </IconToggle>
                <IconToggle
                  active={hidden}
                  onClick={() => toggleBandHidden(band)}
                  label={hidden ? 'Show layer' : 'Hide layer'}
                >
                  {hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                </IconToggle>
              </div>

              {isOpen && band !== Band.Terrain && (
                <ul className="pb-1 pl-6 pr-1">
                  {/* Top of the band first, matching what draws in front. */}
                  {[...objects].reverse().map((object) => {
                    const asset = getAsset(object.assetId) ?? assets.get(object.assetId)
                    return (
                      <li key={object.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            const ref = { kind: 'object' as const, id: object.id }
                            if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelect(ref)
                            else select([ref])
                          }}
                          onMouseEnter={() => setHover({ kind: 'object', id: object.id })}
                          onMouseLeave={() => setHover(null)}
                          className={clsx(
                            'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition',
                            selectedIds.has(object.id)
                              ? 'bg-emerald-600/12 text-emerald-800'
                              : 'text-stone-600 hover:bg-stone-100',
                            object.hidden && 'opacity-45',
                          )}
                        >
                          <img
                            src={asset?.src}
                            alt=""
                            className="h-4 w-4 shrink-0 object-contain"
                            loading="lazy"
                          />
                          <span className="truncate text-[11px]">
                            {object.label ?? asset?.name ?? 'Object'}
                          </span>
                          {object.locked && <LockIcon size={10} className="ml-auto shrink-0 text-stone-400" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {band === Band.Terrain && count > 0 && (
                <ul className="pb-1 pl-6 pr-1">
                  {[...doc.surfaces].reverse().map((surface) => {
                    const material = materials.get(surface.materialId)
                    return (
                      <li key={surface.id}>
                        <button
                          type="button"
                          onClick={() => select([{ kind: 'surface', id: surface.id }])}
                          onMouseEnter={() => setHover({ kind: 'surface', id: surface.id })}
                          onMouseLeave={() => setHover(null)}
                          className={clsx(
                            'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition',
                            selectedIds.has(surface.id)
                              ? 'bg-emerald-600/12 text-emerald-800'
                              : 'text-stone-600 hover:bg-stone-100',
                          )}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10"
                            style={{ background: material?.fill ?? '#b9c2b4' }}
                          />
                          <span className="truncate text-[11px]">{material?.name ?? 'Surface'}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-stone-400 tabular-nums">
                            {formatArea(multiPolyArea(surface.geometry))}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'grid h-5 w-5 shrink-0 place-items-center rounded transition',
        active
          ? 'bg-emerald-600/15 text-emerald-700 opacity-100'
          : 'text-stone-400 opacity-0 hover:bg-stone-200 hover:text-stone-700 group-hover:opacity-100',
      )}
    >
      {children}
    </button>
  )
}
