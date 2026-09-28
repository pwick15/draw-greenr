import { create } from 'zustand'

import { BUILTIN_ASSETS, BUILTIN_CATEGORIES, BUILTIN_MATERIALS } from '@/assets/builtin'
import { invalidateImage, preloadImages } from '@/core/imageCache'
import type { AssetCategory, AssetDef, BandId, MaterialDef } from '@/core/types'
import {
  deleteCustomAsset,
  deleteCustomMaterial,
  getCustomAsset,
  listCustomAssets,
  listCustomMaterials,
  putCustomAsset,
  putCustomMaterial,
  type CustomAssetRecord,
  type CustomMaterialRecord,
} from './db'
import { newId } from './document'

/** Blob URLs, keyed by asset id, so they can be revoked on delete/replace. */
const objectUrls = new Map<string, string>()
const thumbUrls = new Map<string, string>()

function urlFor(map: Map<string, string>, key: string, blob: Blob): string {
  const existing = map.get(key)
  if (existing) URL.revokeObjectURL(existing)
  const url = URL.createObjectURL(blob)
  map.set(key, url)
  return url
}

function revoke(key: string) {
  for (const map of [objectUrls, thumbUrls]) {
    const url = map.get(key)
    if (url) {
      URL.revokeObjectURL(url)
      map.delete(key)
    }
  }
}

const toAssetDef = (record: CustomAssetRecord): AssetDef => ({
  id: record.id,
  name: record.name,
  category: record.category,
  band: record.band,
  source: 'custom',
  src: urlFor(objectUrls, record.id, record.blob),
  defaultSize: record.defaultSize,
  aspectLocked: record.aspectLocked,
  tags: record.tags,
  note: record.note,
})

const toMaterialDef = (record: CustomMaterialRecord): MaterialDef => ({
  id: record.id,
  name: record.name,
  source: 'custom',
  fill: record.fill,
  textureSrc: urlFor(objectUrls, record.id, record.blob),
  textureScale: record.textureScale,
  occludes: record.occludes,
})

export interface NewCustomAsset {
  name: string
  category: string
  band: BandId
  defaultSize: { w: number; h: number }
  aspectLocked: boolean
  tags: string[]
  note?: string
  mime: string
  blob: Blob
  thumb: Blob
}

export interface NewCustomMaterial {
  name: string
  fill: string
  textureScale: number
  occludes: boolean
  mime: string
  blob: Blob
}

interface AssetStore {
  assets: Map<string, AssetDef>
  materials: Map<string, MaterialDef>
  categories: AssetCategory[]
  ready: boolean

  load: () => Promise<void>
  thumbFor: (id: string) => string | undefined

  addAsset: (input: NewCustomAsset) => Promise<AssetDef>
  updateAsset: (id: string, patch: Partial<NewCustomAsset>) => Promise<void>
  removeAsset: (id: string) => Promise<void>

  addMaterial: (input: NewCustomMaterial) => Promise<MaterialDef>
  removeMaterial: (id: string) => Promise<void>
}

const builtinAssetMap = new Map(BUILTIN_ASSETS.map((a) => [a.id, a]))
const builtinMaterialMap = new Map(BUILTIN_MATERIALS.map((m) => [m.id, m]))

export const useAssetStore = create<AssetStore>()((set, get) => ({
  assets: new Map(builtinAssetMap),
  materials: new Map(builtinMaterialMap),
  categories: BUILTIN_CATEGORIES,
  ready: false,

  async load() {
    const [assetRecords, materialRecords] = await Promise.all([listCustomAssets(), listCustomMaterials()])
    const assets = new Map(builtinAssetMap)
    for (const record of assetRecords) {
      assets.set(record.id, toAssetDef(record))
      urlFor(thumbUrls, `${record.id}:thumb`, record.thumb)
    }
    const materials = new Map(builtinMaterialMap)
    for (const record of materialRecords) materials.set(record.id, toMaterialDef(record))
    set({ assets, materials, ready: true })

    // Warm the cache so the first click on the canvas already has alpha masks
    // to pick against, rather than falling back to bounding boxes.
    void preloadImages([...materials.values()].flatMap((m) => (m.textureSrc ? [m.textureSrc] : [])))
  },

  thumbFor(id) {
    return thumbUrls.get(`${id}:thumb`) ?? get().assets.get(id)?.src
  },

  async addAsset(input) {
    const now = Date.now()
    const record: CustomAssetRecord = { id: newId('asset'), createdAt: now, updatedAt: now, ...input }
    await putCustomAsset(record)
    const def = toAssetDef(record)
    urlFor(thumbUrls, `${record.id}:thumb`, record.thumb)
    set((s) => ({ assets: new Map(s.assets).set(def.id, def) }))
    return def
  },

  async updateAsset(id, patch) {
    const existing = await getCustomAsset(id)
    if (!existing) return
    const record: CustomAssetRecord = { ...existing, ...patch, updatedAt: Date.now() }
    await putCustomAsset(record)
    // Replacing artwork invalidates both the decoded image and its alpha mask.
    if (patch.blob) invalidateImage(objectUrls.get(id) ?? '')
    const def = toAssetDef(record)
    if (patch.thumb) urlFor(thumbUrls, `${id}:thumb`, record.thumb)
    set((s) => ({ assets: new Map(s.assets).set(id, def) }))
  },

  async removeAsset(id) {
    await deleteCustomAsset(id)
    const url = objectUrls.get(id)
    if (url) invalidateImage(url)
    revoke(id)
    revoke(`${id}:thumb`)
    set((s) => {
      const assets = new Map(s.assets)
      assets.delete(id)
      return { assets }
    })
  },

  async addMaterial(input) {
    const now = Date.now()
    const record: CustomMaterialRecord = { id: newId('mat'), createdAt: now, updatedAt: now, ...input }
    await putCustomMaterial(record)
    const def = toMaterialDef(record)
    set((s) => ({ materials: new Map(s.materials).set(def.id, def) }))
    void preloadImages(def.textureSrc ? [def.textureSrc] : [])
    return def
  },

  async removeMaterial(id) {
    await deleteCustomMaterial(id)
    const url = objectUrls.get(id)
    if (url) invalidateImage(url)
    revoke(id)
    set((s) => {
      const materials = new Map(s.materials)
      materials.delete(id)
      return { materials }
    })
  },
}))

/** Non-reactive read, for use inside event handlers and geometry code. */
export const getAssets = (): ReadonlyMap<string, AssetDef> => useAssetStore.getState().assets
export const getMaterials = (): ReadonlyMap<string, MaterialDef> => useAssetStore.getState().materials
export const getAsset = (id: string): AssetDef | undefined => useAssetStore.getState().assets.get(id)
export const getMaterial = (id: string): MaterialDef | undefined => useAssetStore.getState().materials.get(id)
