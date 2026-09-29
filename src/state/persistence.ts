import type Konva from 'konva'
import { useEffect, useRef } from 'react'

import { documentBounds } from './document'
import { fitRect } from '@/core/viewport'
import type { GardenDoc } from '@/core/types'
import { DEFAULT_SETTINGS } from '@/core/types'

import { preloadImages } from '@/core/imageCache'
import { buildTakeoff, takeoffToCsv } from '@/core/schedule'

import { getAssets, getMaterials, useAssetStore } from './assets'
import { getMeta, putDoc, setMeta, getDoc } from './db'
import { useDocStore, createEmptyDoc } from './document'
import { useEditorStore } from './editor'

// On-disk identifiers, deliberately unchanged by the rename to Draw Greenr:
// the format string is written inside every saved file and the extension is on
// every file anyone has already exported. Changing either makes old plans
// unopenable for no benefit.
export const DOC_FORMAT = 'greenr-garden'
export const DOC_VERSION = 1
export const DOC_EXTENSION = 'greenr'

const LAST_DOC_KEY = 'lastDocId'

// The live Konva stage, registered by the canvas so exports can reach it
// without threading a ref through every layer of UI.
let stageRef: Konva.Stage | null = null
export const registerStage = (stage: Konva.Stage | null): void => {
  stageRef = stage
}

// ---------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY = 900

export async function saveDocNow(): Promise<void> {
  const { doc } = useDocStore.getState()
  await putDoc({ id: doc.id, name: doc.name, updatedAt: doc.updatedAt, doc })
  await setMeta(LAST_DOC_KEY, doc.id)
}

/**
 * Debounced autosave. Everything is local, so there is no reason to make
 * anyone press Save — but a debounce matters because a drag fires document
 * updates every frame.
 */
export function useAutosave(enabled = true): void {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    const unsubscribe = useDocStore.subscribe((state, previous) => {
      if (state.doc === previous.doc) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        void saveDocNow()
      }, AUTOSAVE_DELAY)
    })
    return () => {
      unsubscribe()
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [enabled])
}

/** Restore the last open plan, or start a fresh one. */
export async function restoreLastDoc(): Promise<boolean> {
  const id = await getMeta<string>(LAST_DOC_KEY)
  if (!id) return false
  const record = await getDoc(id)
  if (!record) return false
  useDocStore.getState().resetDoc(normaliseDoc(record.doc))
  return true
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safeFilename = (name: string) =>
  name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'garden'

/**
 * Save the materials take-off as a spreadsheet.
 *
 * UTF-8 BOM first: without it Excel reads the file as the local codepage and
 * mangles the ² in "m²" — which is in nearly every column heading here.
 */
export function exportTakeoffCsv(): void {
  const { doc } = useDocStore.getState()
  const csv = takeoffToCsv(buildTakeoff(doc, getAssets(), getMaterials()))
  download(
    `${safeFilename(doc.name)}-takeoff.csv`,
    new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }),
  )
}

export function exportDocJson(): void {
  const { doc } = useDocStore.getState()
  const payload = { format: DOC_FORMAT, version: DOC_VERSION, doc }
  download(
    `${safeFilename(doc.name)}.${DOC_EXTENSION}`,
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  )
}

export async function importDocJson(file: File): Promise<void> {
  let payload: { format?: string; version?: number; doc?: GardenDoc }
  try {
    payload = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (payload.format !== DOC_FORMAT || !payload.doc) {
    throw new Error('That file is not a Greenr garden plan.')
  }
  if ((payload.version ?? 0) > DOC_VERSION) {
    throw new Error('That plan was saved by a newer version of Greenr.')
  }
  useDocStore.getState().resetDoc(normaliseDoc(payload.doc))
  useEditorStore.getState().clearSelection()
  await saveDocNow()
}

/**
 * Fill in anything a plan from an older build (or a hand-edited file) might be
 * missing, so one absent field cannot take the whole canvas down.
 */
function normaliseDoc(input: GardenDoc): GardenDoc {
  const base = createEmptyDoc()
  return {
    ...base,
    ...input,
    objects: input.objects ?? {},
    surfaces: Array.isArray(input.surfaces) ? input.surfaces : [],
    settings: { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) },
  }
}

// ---------------------------------------------------------------------------
// Image export
// ---------------------------------------------------------------------------

export interface PngExportOptions {
  /** Output resolution multiplier applied on top of the fitted view. */
  pixelRatio: number
  includeGrid: boolean
  padding: number
}

export const DEFAULT_PNG_OPTIONS: PngExportOptions = {
  pixelRatio: 2,
  includeGrid: false,
  padding: 0.06,
}

/**
 * Frames the whole plan, captures the stage, then restores the view.
 *
 * Capturing through the live stage rather than a second offscreen renderer
 * means the export is by construction identical to what is on screen — no
 * parallel draw path to keep in sync.
 */
export async function exportPng(options: Partial<PngExportOptions> = {}): Promise<void> {
  const opts = { ...DEFAULT_PNG_OPTIONS, ...options }
  const stage = stageRef
  if (!stage) throw new Error('The canvas is not ready yet.')

  const editor = useEditorStore.getState()
  const { doc } = useDocStore.getState()
  const bounds = documentBounds(doc)
  if (!bounds) throw new Error('There is nothing on the plan to export.')

  const restore = {
    viewport: editor.viewport,
    selection: editor.selection,
    showGrid: editor.showGrid,
    hover: editor.hover,
  }

  editor.select([])
  editor.setHover(null)
  if (editor.showGrid !== opts.includeGrid) editor.toggle('showGrid')
  editor.setViewport(fitRect(bounds, editor.stageSize.width, editor.stageSize.height, opts.padding))

  try {
    // Zooming out reveals objects that were culled, whose artwork may never
    // have been decoded — without this the export can capture placeholders.
    await preloadImages(referencedSources(doc))
    // Let React commit the new viewport and Konva redraw before capturing.
    await nextFrame()
    await nextFrame()
    const dataUrl = stage.toDataURL({ pixelRatio: opts.pixelRatio, mimeType: 'image/png' })
    const blob = await (await fetch(dataUrl)).blob()
    download(`${safeFilename(doc.name)}.png`, blob)
  } finally {
    const current = useEditorStore.getState()
    current.setViewport(restore.viewport)
    current.select(restore.selection)
    current.setHover(restore.hover)
    if (current.showGrid !== restore.showGrid) current.toggle('showGrid')
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** Every image URL a document depends on, deduplicated by asset. */
function referencedSources(doc: GardenDoc): Set<string> {
  const { assets, materials } = useAssetStore.getState()
  const set = new Set<string>()
  for (const object of Object.values(doc.objects)) {
    const asset = assets.get(object.assetId)
    if (asset) set.add(asset.src)
  }
  for (const surface of doc.surfaces) {
    const material = materials.get(surface.materialId)
    if (material?.textureSrc) set.add(material.textureSrc)
  }
  return set
}
