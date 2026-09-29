import { create } from 'zustand'

import { getMeta, setMeta } from './db'

/**
 * Starred assets and a rolling list of what was last placed.
 *
 * Both exist because the asset library is a grid behind a category rail, and a
 * planting plan is nearly always the same dozen items over and over. Recents
 * are the half that earns its keep without anyone maintaining it — nobody
 * curates a favourites list, but everybody repeats themselves.
 */

const FAVOURITES_KEY = 'quick.favourites'
const RECENTS_KEY = 'quick.recents'

/** Long enough to cover a working session, short enough to stay scannable. */
const MAX_RECENTS = 12

interface QuickAccessState {
  favourites: string[]
  recents: string[]
  ready: boolean

  load: () => Promise<void>
  toggleFavourite: (assetId: string) => void
  noteUse: (assetId: string) => void
  reorderFavourites: (assetId: string, toIndex: number) => void
}

const persist = (key: string, value: string[]): void => {
  // Fire and forget: awaiting a write in the middle of placing an object would
  // be absurd. Swallowing the failure is deliberate too — storage can be
  // unavailable in private browsing or over quota, and the list still works
  // for this session. Losing a star is not worth interrupting anyone.
  void setMeta(key, value).catch(() => {})
}

export const useQuickAccessStore = create<QuickAccessState>()((set, get) => ({
  favourites: [],
  recents: [],
  ready: false,

  async load() {
    const [favourites, recents] = await Promise.all([
      getMeta<string[]>(FAVOURITES_KEY),
      getMeta<string[]>(RECENTS_KEY),
    ])
    set({
      favourites: Array.isArray(favourites) ? favourites : [],
      recents: Array.isArray(recents) ? recents : [],
      ready: true,
    })
  },

  toggleFavourite(assetId) {
    const { favourites } = get()
    const next = favourites.includes(assetId)
      ? favourites.filter((id) => id !== assetId)
      : [...favourites, assetId]
    set({ favourites: next })
    persist(FAVOURITES_KEY, next)
  },

  noteUse(assetId) {
    const { recents } = get()
    // Move to the front rather than appending, so the list reflects what is
    // being used now and not what was used first.
    const next = [assetId, ...recents.filter((id) => id !== assetId)].slice(0, MAX_RECENTS)
    if (next.length === recents.length && next.every((id, i) => id === recents[i])) return
    set({ recents: next })
    persist(RECENTS_KEY, next)
  },

  reorderFavourites(assetId, toIndex) {
    const { favourites } = get()
    const from = favourites.indexOf(assetId)
    if (from < 0) return
    const next = favourites.slice()
    next.splice(from, 1)
    next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, assetId)
    set({ favourites: next })
    persist(FAVOURITES_KEY, next)
  },
}))

/** Non-reactive read, for event handlers and command functions. */
export const noteAssetUse = (assetId: string): void =>
  useQuickAccessStore.getState().noteUse(assetId)
