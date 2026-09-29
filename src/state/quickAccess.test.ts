import { beforeEach, describe, expect, it } from 'vitest'

import { useQuickAccessStore } from './quickAccess'

const state = () => useQuickAccessStore.getState()

describe('favourites', () => {
  beforeEach(() => {
    useQuickAccessStore.setState({ favourites: [], recents: [] })
  })

  it('stars an asset', () => {
    state().toggleFavourite('oak')
    expect(state().favourites).toEqual(['oak'])
  })

  it('unstars on a second toggle', () => {
    state().toggleFavourite('oak')
    state().toggleFavourite('oak')
    expect(state().favourites).toEqual([])
  })

  it('keeps the order things were starred in', () => {
    state().toggleFavourite('oak')
    state().toggleFavourite('bench')
    state().toggleFavourite('pond-small')
    expect(state().favourites).toEqual(['oak', 'bench', 'pond-small'])
  })

  it('removes only the one unstarred', () => {
    for (const id of ['oak', 'bench', 'pond-small']) state().toggleFavourite(id)
    state().toggleFavourite('bench')
    expect(state().favourites).toEqual(['oak', 'pond-small'])
  })
})

describe('reorderFavourites', () => {
  beforeEach(() => {
    useQuickAccessStore.setState({ favourites: ['a', 'b', 'c', 'd'], recents: [] })
  })

  it('moves an item later in the list', () => {
    state().reorderFavourites('a', 2)
    expect(state().favourites).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item earlier in the list', () => {
    state().reorderFavourites('d', 0)
    expect(state().favourites).toEqual(['d', 'a', 'b', 'c'])
  })

  it('clamps an index past the end instead of dropping the item', () => {
    state().reorderFavourites('a', 99)
    expect(state().favourites).toEqual(['b', 'c', 'd', 'a'])
  })

  it('ignores an asset that is not starred', () => {
    state().reorderFavourites('zzz', 0)
    expect(state().favourites).toEqual(['a', 'b', 'c', 'd'])
  })

  it('never loses or duplicates an entry', () => {
    state().reorderFavourites('c', 1)
    expect([...state().favourites].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('recents', () => {
  beforeEach(() => {
    useQuickAccessStore.setState({ favourites: [], recents: [] })
  })

  it('puts the newest use first', () => {
    state().noteUse('oak')
    state().noteUse('bench')
    expect(state().recents).toEqual(['bench', 'oak'])
  })

  it('promotes a repeat rather than listing it twice', () => {
    state().noteUse('oak')
    state().noteUse('bench')
    state().noteUse('oak')
    expect(state().recents).toEqual(['oak', 'bench'])
  })

  it('drops the oldest once the list is full', () => {
    for (let i = 0; i < 20; i++) state().noteUse(`asset-${i}`)
    const { recents } = state()
    expect(recents.length).toBeLessThanOrEqual(12)
    expect(recents[0]).toBe('asset-19')
    expect(recents).not.toContain('asset-0')
  })

  it('leaves the array identical when nothing changed', () => {
    state().noteUse('oak')
    const before = state().recents
    state().noteUse('oak')
    // Re-placing the same asset twice in a row must not churn the reference,
    // or every placement re-renders the tray for no reason.
    expect(state().recents).toBe(before)
  })
})
