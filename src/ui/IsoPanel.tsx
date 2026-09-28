import clsx from 'clsx'
import { Suspense, lazy, useCallback, useRef, useState } from 'react'

import type { Compass } from '@/three/IsoView'
import { useAssetStore } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'

import { CloseIcon, DownloadIcon } from './icons'
import { Button } from './primitives'

// three.js and everything under src/three only downloads when this opens.
const IsoView = lazy(() => import('@/three/IsoView'))

const COMPASS_POINTS: { value: Compass; label: string }[] = [
  { value: 0, label: 'NE' },
  { value: 90, label: 'SE' },
  { value: 180, label: 'SW' },
  { value: 270, label: 'NW' },
]

export function IsoPanel({ onClose }: { onClose: () => void }) {
  const doc = useDocStore((s) => s.doc)
  const assets = useAssetStore((s) => s.assets)
  const materials = useAssetStore((s) => s.materials)
  const hiddenBands = useEditorStore((s) => s.hiddenBands)

  const [compass, setCompass] = useState<Compass>(0)
  const [sunElevation, setSunElevation] = useState(48)
  const [shadows, setShadows] = useState(true)
  const [decalCount, setDecalCount] = useState(0)

  const exportRef = useRef<((name: string) => void) | null>(null)

  const handleReady = useCallback((api: { exportPng: (name: string) => void; decalCount: number }) => {
    exportRef.current = api.exportPng
    setDecalCount(api.decalCount)
  }, [])

  const empty = Object.keys(doc.objects).length === 0 && doc.surfaces.length === 0

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#eef1ec]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-3">
        <span className="text-sm font-semibold text-stone-800">Isometric view</span>

        <div className="flex gap-0.5 rounded-lg bg-stone-100 p-0.5">
          {COMPASS_POINTS.map((point) => (
            <button
              key={point.value}
              type="button"
              onClick={() => setCompass(point.value)}
              title={`Look from the ${point.label}`}
              className={clsx(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                compass === point.value
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800',
              )}
            >
              {point.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[11px] text-stone-500">
          Sun
          <input
            type="range"
            min={12}
            max={85}
            value={sunElevation}
            onChange={(e) => setSunElevation(Number(e.target.value))}
            className="w-28 accent-emerald-600"
            aria-label="Sun elevation"
          />
          <span className="w-8 tabular-nums">{sunElevation}°</span>
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <input
            type="checkbox"
            checked={shadows}
            onChange={(e) => setShadows(e.target.checked)}
            className="accent-emerald-600"
          />
          Shadows
        </label>

        {decalCount > 0 && (
          <span
            className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700 ring-1 ring-amber-200"
            title="Custom assets have no 3D recipe, so they are laid flat on the ground as their plan symbol."
          >
            {decalCount} item{decalCount === 1 ? '' : 's'} shown flat
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => exportRef.current?.(doc.name || 'garden-3d')}
            disabled={empty}
          >
            <DownloadIcon size={15} /> Export PNG
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the plan"
            title="Back to the plan"
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <CloseIcon size={17} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {empty ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="text-sm font-medium text-stone-600">Nothing to show yet</p>
              <p className="mt-1 text-xs text-stone-400">
                Draw some ground and place a few things, then come back.
              </p>
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-sm text-stone-500">
                Loading the 3D renderer…
              </div>
            }
          >
            <IsoView
              doc={doc}
              assets={assets}
              materials={materials}
              hiddenBands={hiddenBands}
              compass={compass}
              sunElevation={sunElevation}
              shadows={shadows}
              onReady={handleReady}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
