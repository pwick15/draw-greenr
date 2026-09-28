import { create } from 'zustand'

import type { GardenDoc } from '@/core/types'

import { deleteDoc, getDoc, listDocs, putDoc, type DocRecord } from './db'
import { createEmptyDoc, newId, useDocStore } from './document'
import { useEditorStore } from './editor'
import { saveDocNow } from './persistence'

export interface PlanSummary {
  id: string
  name: string
  updatedAt: number
  objectCount: number
  surfaceCount: number
}

interface PlansStore {
  plans: PlanSummary[]
  loading: boolean
  refresh: () => Promise<void>
  openPlan: (id: string) => Promise<void>
  createPlan: (name?: string) => Promise<string>
  duplicateCurrent: () => Promise<string>
  renamePlan: (id: string, name: string) => Promise<void>
  removePlan: (id: string) => Promise<void>
}

const summarise = (record: DocRecord): PlanSummary => ({
  id: record.id,
  name: record.doc?.name ?? record.name,
  updatedAt: record.updatedAt,
  objectCount: Object.keys(record.doc?.objects ?? {}).length,
  surfaceCount: record.doc?.surfaces?.length ?? 0,
})

/**
 * Switching plans always writes the current one first. Autosave is debounced,
 * so without this the last second of edits would be lost every time someone
 * changed plan — the one moment it would be most obvious and least forgivable.
 */
async function commitCurrent(): Promise<void> {
  await saveDocNow()
}

function adoptDoc(doc: GardenDoc): void {
  useDocStore.getState().resetDoc(doc)
  const editor = useEditorStore.getState()
  editor.clearSelection()
  editor.clearPlot()
  editor.setPlacing(null)
  editor.setMeasure(null)
  editor.setIsolatedBand(null)
}

export const usePlansStore = create<PlansStore>()((set, get) => ({
  plans: [],
  loading: false,

  async refresh() {
    set({ loading: true })
    try {
      const records = await listDocs()
      set({ plans: records.map(summarise), loading: false })
    } catch {
      set({ loading: false })
    }
  },

  async openPlan(id) {
    if (useDocStore.getState().doc.id === id) return
    await commitCurrent()
    const record = await getDoc(id)
    if (!record) return
    adoptDoc(record.doc)
    await saveDocNow()
    await get().refresh()
  },

  async createPlan(name) {
    await commitCurrent()
    const doc = createEmptyDoc(name?.trim() || nextUntitledName(get().plans))
    adoptDoc(doc)
    await saveDocNow()
    await get().refresh()
    return doc.id
  },

  async duplicateCurrent() {
    await commitCurrent()
    const source = useDocStore.getState().doc
    const now = Date.now()
    const copy: GardenDoc = {
      ...source,
      id: newId('doc'),
      name: `${source.name} copy`,
      createdAt: now,
      updatedAt: now,
    }
    adoptDoc(copy)
    await saveDocNow()
    await get().refresh()
    return copy.id
  },

  async renamePlan(id, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (useDocStore.getState().doc.id === id) {
      useDocStore.getState().apply('Rename plan', (draft) => {
        draft.name = trimmed
      })
      await saveDocNow()
    } else {
      const record = await getDoc(id)
      if (!record) return
      await putDoc({ ...record, name: trimmed, doc: { ...record.doc, name: trimmed } })
    }
    await get().refresh()
  },

  async removePlan(id) {
    await deleteDoc(id)
    // Deleting the plan you are looking at has to leave you somewhere: the
    // most recent survivor, or a fresh empty plan if that was the last one.
    if (useDocStore.getState().doc.id === id) {
      const remaining = await listDocs()
      if (remaining.length > 0) adoptDoc(remaining[0].doc)
      else adoptDoc(createEmptyDoc())
      await saveDocNow()
    }
    await get().refresh()
  },
}))

function nextUntitledName(plans: PlanSummary[]): string {
  const used = new Set(plans.map((p) => p.name))
  if (!used.has('Untitled garden')) return 'Untitled garden'
  for (let i = 2; i < 500; i++) {
    const candidate = `Untitled garden ${i}`
    if (!used.has(candidate)) return candidate
  }
  return `Untitled garden ${Date.now()}`
}

/** "3 minutes ago", for the plan list. */
export function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min ago`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} h ago`
  const days = hours / 24
  if (days < 7) return `${Math.round(days)} d ago`
  return new Date(timestamp).toLocaleDateString()
}
