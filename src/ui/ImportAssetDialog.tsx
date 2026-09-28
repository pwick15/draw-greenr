import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  DEFAULT_IMPORT_OPTIONS,
  isSupportedFile,
  processImport,
  suggestSize,
  type ImportOptions,
  type ImportResult,
} from '@/assets/importAsset'
import { BAND_META, BAND_ORDER, Band, type BandId } from '@/core/types'
import { formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'

import { UploadIcon } from './icons'
import { Button, Field, Modal, NumberInput, Select, TextInput, Toggle } from './primitives'

interface ImportAssetDialogProps {
  open: boolean
  onClose: () => void
  /** File handed in from a drop on the canvas or panel. */
  initialFile?: File | null
}

export function ImportAssetDialog({ open, onClose, initialFile }: ImportAssetDialogProps) {
  const categories = useAssetStore((s) => s.categories)
  const addAsset = useAssetStore((s) => s.addAsset)

  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('shrubs')
  const [band, setBand] = useState<BandId>(Band.Planting)
  const [widthMeters, setWidthMeters] = useState(2)
  const [aspectLocked, setAspectLocked] = useState(true)

  const lastPreview = useRef<string | null>(null)

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setOptions(DEFAULT_IMPORT_OPTIONS)
    setError(null)
    setName('')
    setWidthMeters(2)
    setAspectLocked(true)
    setBand(Band.Planting)
    setCategory('shrubs')
  }, [])

  useEffect(() => {
    if (open && initialFile) void accept(initialFile)
    if (!open) reset()
    // `accept` is stable enough for this one-shot handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile])

  // Revoke the previous preview whenever a new one replaces it.
  useEffect(() => {
    const url = result?.previewUrl ?? null
    if (lastPreview.current && lastPreview.current !== url) URL.revokeObjectURL(lastPreview.current)
    lastPreview.current = url
  }, [result])

  useEffect(
    () => () => {
      if (lastPreview.current) URL.revokeObjectURL(lastPreview.current)
    },
    [],
  )

  async function accept(next: File) {
    if (!isSupportedFile(next)) {
      setError('Use a PNG, SVG, WebP, AVIF, GIF or JPEG.')
      return
    }
    setError(null)
    setFile(next)
    setName(prettyName(next.name))
    await run(next, DEFAULT_IMPORT_OPTIONS)
  }

  async function run(source: File, next: ImportOptions) {
    setProcessing(true)
    try {
      const processed = await processImport(source, next)
      setResult(processed)
      setWidthMeters((current) => current || 2)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that image.')
      setResult(null)
    } finally {
      setProcessing(false)
    }
  }

  const updateOptions = (patch: Partial<ImportOptions>) => {
    const next = { ...options, ...patch }
    setOptions(next)
    if (file) void run(file, next)
  }

  const size = result ? suggestSize(result.width, result.height, widthMeters) : { w: widthMeters, h: widthMeters }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      await addAsset({
        name: name.trim() || 'Untitled asset',
        category,
        band,
        defaultSize: size,
        aspectLocked,
        tags: ['custom'],
        mime: result.mime,
        blob: result.blob,
        thumb: result.thumb,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that asset.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Import a custom asset"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!result || processing || saving} onClick={() => void handleSave()}>
            {saving ? 'Adding…' : 'Add to library'}
          </Button>
        </>
      }
    >
      {!result ? (
        <DropZone onFile={(f) => void accept(f)} error={error} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex flex-col gap-3">
            <ScalePreview src={result.previewUrl} widthMeters={size.w} heightMeters={size.h} />
            <p className="text-[11px] leading-relaxed text-stone-500">
              Each grid square is one metre. Set the width until the asset looks the size it should be
              in the garden — everything else scales with it.
            </p>

            <div className="rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
              <h3 className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Artwork
              </h3>
              <div className="flex flex-col gap-2.5">
                <Toggle
                  label="Trim empty edges"
                  checked={options.trim}
                  onChange={(v) => updateOptions({ trim: v })}
                />
                <Toggle
                  label="Remove flat background"
                  checked={options.removeBackground}
                  onChange={(v) => updateOptions({ removeBackground: v })}
                />
                {options.removeBackground && (
                  <div className="flex flex-col gap-1 pl-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">Tolerance</span>
                      <span className="text-[11px] text-stone-400 tabular-nums">
                        {Math.round(options.tolerance * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={60}
                      value={Math.round(options.tolerance * 100)}
                      onChange={(e) => updateOptions({ tolerance: Number(e.target.value) / 100 })}
                      className="w-full accent-emerald-600"
                    />
                    <p className="text-[10px] leading-relaxed text-stone-400">
                      Floods inwards from the edges. Raise it if background survives; lower it if the
                      subject is being eaten.
                    </p>
                  </div>
                )}
              </div>
              {processing && <p className="pt-2 text-[11px] text-emerald-700">Processing…</p>}
              <p className="pt-2 text-[10px] text-stone-400 tabular-nums">
                {result.width} × {result.height} px
                {result.mime === 'image/svg+xml' && ' · vector, kept as-is'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Olive tree" />
            </Field>

            <Field label="Width" hint={`Height follows at ${formatDistance(size.h)}`}>
              <NumberInput
                value={widthMeters}
                onCommit={(v) => setWidthMeters(Math.min(500, Math.max(0.02, v)))}
                unit="m"
              />
            </Field>

            <Field label="Category">
              <Select
                value={category}
                onChange={setCategory}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label="Layer" hint={BAND_META[band].hint}>
              <Select
                value={String(band)}
                onChange={(v) => setBand(Number(v) as BandId)}
                options={BAND_ORDER.filter((b) => b !== Band.Terrain).map((b) => ({
                  value: String(b),
                  label: BAND_META[b].name,
                }))}
              />
            </Field>

            <div className="pt-1">
              <Toggle label="Lock aspect when resizing" checked={aspectLocked} onChange={setAspectLocked} />
            </div>

            <button
              type="button"
              onClick={reset}
              className="mt-auto text-left text-[11px] text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
            >
              Choose a different file
            </button>
          </div>
        </div>
      )}
      {error && result && <p className="pt-3 text-xs text-rose-600">{error}</p>}
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function DropZone({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) onFile(file)
        }}
        className={clsx(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-14 text-center transition',
          over ? 'border-emerald-500 bg-emerald-50' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50',
        )}
      >
        <UploadIcon size={28} className="text-stone-400" />
        <span className="text-sm font-medium text-stone-700">Drop an image here, or click to choose</span>
        <span className="text-xs text-stone-400">PNG, SVG, WebP, AVIF, GIF or JPEG</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onFile(file)
          }}
        />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <p className="text-[11px] leading-relaxed text-stone-400">
        Top-down artwork works best. Anything with transparency keeps it, and a photo on a plain
        backdrop can have that backdrop knocked out on the next step.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Preview against a one-metre grid, so the real-world size is judged by eye. */
function ScalePreview({
  src,
  widthMeters,
  heightMeters,
}: {
  src: string
  widthMeters: number
  heightMeters: number
}) {
  const BOX = 260
  // Frame roughly 1.6x the asset, rounded to whole metres, minimum 2 m.
  const span = Math.max(2, Math.ceil(Math.max(widthMeters, heightMeters) * 1.6))
  const pxPerMetre = BOX / span

  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-lg ring-1 ring-stone-200"
      style={{
        height: BOX,
        backgroundColor: '#eef1ec',
        backgroundImage: `linear-gradient(to right, rgba(94,112,96,0.28) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(94,112,96,0.28) 1px, transparent 1px)`,
        backgroundSize: `${pxPerMetre}px ${pxPerMetre}px`,
      }}
    >
      <img
        src={src}
        alt="Asset preview"
        style={{
          width: widthMeters * pxPerMetre,
          height: heightMeters * pxPerMetre,
          maxWidth: 'none',
          maxHeight: 'none',
        }}
        className="object-contain drop-shadow-sm"
      />
      <span className="absolute bottom-1.5 right-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-stone-500 tabular-nums">
        {span} m across
      </span>
    </div>
  )
}

function prettyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}
