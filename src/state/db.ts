import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { BandId, GardenDoc } from '@/core/types'

/**
 * Everything lives in the browser. A garden plan is personal, usually private,
 * and small — there is nothing here that needs a server, and local-first means
 * custom assets keep working offline and on a plane.
 */

export interface CustomAssetRecord {
  id: string
  name: string
  category: string
  band: BandId
  defaultSize: { w: number; h: number }
  aspectLocked: boolean
  tags: string[]
  note?: string
  mime: string
  blob: Blob
  /** Small PNG for the asset browser, so the full artwork is not decoded there. */
  thumb: Blob
  createdAt: number
  updatedAt: number
}

export interface CustomMaterialRecord {
  id: string
  name: string
  fill: string
  textureScale: number
  occludes: boolean
  mime: string
  blob: Blob
  createdAt: number
  updatedAt: number
}

export interface DocRecord {
  id: string
  name: string
  updatedAt: number
  /** PNG preview of the plan, for the "my gardens" list. */
  preview?: Blob
  doc: GardenDoc
}

interface GreenrDB extends DBSchema {
  assets: { key: string; value: CustomAssetRecord; indexes: { byCategory: string } }
  materials: { key: string; value: CustomMaterialRecord }
  documents: { key: string; value: DocRecord; indexes: { byUpdated: number } }
  meta: { key: string; value: unknown }
}

const DB_NAME = 'greenr'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<GreenrDB>> | null = null

export function db(): Promise<IDBPDatabase<GreenrDB>> {
  dbPromise ??= openDB<GreenrDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('assets')) {
        const store = database.createObjectStore('assets', { keyPath: 'id' })
        store.createIndex('byCategory', 'category')
      }
      if (!database.objectStoreNames.contains('materials')) {
        database.createObjectStore('materials', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('documents')) {
        const store = database.createObjectStore('documents', { keyPath: 'id' })
        store.createIndex('byUpdated', 'updatedAt')
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta')
      }
    },
  })
  return dbPromise
}

// --- custom assets ---------------------------------------------------------

export const listCustomAssets = async (): Promise<CustomAssetRecord[]> =>
  (await db()).getAll('assets')

export const putCustomAsset = async (record: CustomAssetRecord): Promise<void> => {
  await (await db()).put('assets', record)
}

export const deleteCustomAsset = async (id: string): Promise<void> => {
  await (await db()).delete('assets', id)
}

export const getCustomAsset = async (id: string): Promise<CustomAssetRecord | undefined> =>
  (await db()).get('assets', id)

// --- custom materials ------------------------------------------------------

export const listCustomMaterials = async (): Promise<CustomMaterialRecord[]> =>
  (await db()).getAll('materials')

export const putCustomMaterial = async (record: CustomMaterialRecord): Promise<void> => {
  await (await db()).put('materials', record)
}

export const deleteCustomMaterial = async (id: string): Promise<void> => {
  await (await db()).delete('materials', id)
}

// --- documents -------------------------------------------------------------

export const listDocs = async (): Promise<DocRecord[]> => {
  const all = await (await db()).getAll('documents')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getDoc = async (id: string): Promise<DocRecord | undefined> =>
  (await db()).get('documents', id)

export const putDoc = async (record: DocRecord): Promise<void> => {
  await (await db()).put('documents', record)
}

export const deleteDoc = async (id: string): Promise<void> => {
  await (await db()).delete('documents', id)
}

// --- meta ------------------------------------------------------------------

export const getMeta = async <T>(key: string): Promise<T | undefined> =>
  (await db()).get('meta', key) as Promise<T | undefined>

export const setMeta = async (key: string, value: unknown): Promise<void> => {
  await (await db()).put('meta', value, key)
}
