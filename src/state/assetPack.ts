import type { BandId } from '@/core/types'
import { Band } from '@/core/types'

import { useAssetStore } from './assets'
import { getCustomAsset, listCustomMaterials } from './db'

/**
 * Asset packs are a single JSON file with the artwork inlined as data URLs.
 *
 * A zip would be smaller, but a plain JSON file is diffable, needs no
 * dependency, and can be hand-edited — which matters for something users are
 * meant to trade between each other.
 */
export const PACK_FORMAT = 'greenr-asset-pack'
export const PACK_VERSION = 1
export const PACK_EXTENSION = 'greenrpack'

interface PackedAsset {
  name: string
  category: string
  band: BandId
  defaultSize: { w: number; h: number }
  aspectLocked: boolean
  tags: string[]
  note?: string
  mime: string
  data: string
  thumb: string
}

interface PackedMaterial {
  name: string
  fill: string
  textureScale: number
  occludes: boolean
  mime: string
  data: string
}

interface AssetPack {
  format: typeof PACK_FORMAT
  version: number
  createdAt: number
  assets: PackedAsset[]
  materials: PackedMaterial[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the image data.'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Give the click a tick to start before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportAssetPack(assetIds: string[], includeMaterials = true): Promise<void> {
  const assets: PackedAsset[] = []
  for (const id of assetIds) {
    const record = await getCustomAsset(id)
    if (!record) continue
    assets.push({
      name: record.name,
      category: record.category,
      band: record.band,
      defaultSize: record.defaultSize,
      aspectLocked: record.aspectLocked,
      tags: record.tags,
      note: record.note,
      mime: record.mime,
      data: await blobToDataUrl(record.blob),
      thumb: await blobToDataUrl(record.thumb),
    })
  }

  const materials: PackedMaterial[] = []
  if (includeMaterials) {
    for (const record of await listCustomMaterials()) {
      materials.push({
        name: record.name,
        fill: record.fill,
        textureScale: record.textureScale,
        occludes: record.occludes,
        mime: record.mime,
        data: await blobToDataUrl(record.blob),
      })
    }
  }

  const pack: AssetPack = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    createdAt: Date.now(),
    assets,
    materials,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  download(`greenr-assets-${stamp}.${PACK_EXTENSION}`, new Blob([JSON.stringify(pack)], { type: 'application/json' }))
}

const VALID_BANDS = new Set<number>(Object.values(Band))

/** Returns the number of assets brought in. */
export async function importAssetPack(file: File): Promise<number> {
  let pack: AssetPack
  try {
    pack = JSON.parse(await file.text()) as AssetPack
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (pack.format !== PACK_FORMAT) throw new Error('That file is not a Greenr asset pack.')
  if (pack.version > PACK_VERSION) {
    throw new Error('That pack was made with a newer version of Greenr.')
  }

  const store = useAssetStore.getState()
  let count = 0

  for (const packed of pack.assets ?? []) {
    if (!packed.data || !packed.name) continue
    await store.addAsset({
      name: packed.name,
      category: packed.category || 'custom',
      // Trust nothing from a file someone else made: fall back to a sane band.
      band: VALID_BANDS.has(packed.band) ? packed.band : Band.Furniture,
      defaultSize: {
        w: clampSize(packed.defaultSize?.w),
        h: clampSize(packed.defaultSize?.h),
      },
      aspectLocked: Boolean(packed.aspectLocked),
      tags: Array.isArray(packed.tags) ? packed.tags.map(String) : [],
      note: packed.note,
      mime: packed.mime || 'image/png',
      blob: await dataUrlToBlob(packed.data),
      thumb: await dataUrlToBlob(packed.thumb || packed.data),
    })
    count++
  }

  for (const packed of pack.materials ?? []) {
    if (!packed.data || !packed.name) continue
    await store.addMaterial({
      name: packed.name,
      fill: packed.fill || '#9aa79a',
      textureScale: clampSize(packed.textureScale, 2, 0.05, 50),
      occludes: packed.occludes !== false,
      mime: packed.mime || 'image/png',
      blob: await dataUrlToBlob(packed.data),
    })
  }

  return count
}

function clampSize(value: unknown, fallback = 1, min = 0.01, max = 500): number {
  const n = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
