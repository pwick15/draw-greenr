/**
 * Storage durability.
 *
 * Everything lives in IndexedDB, which browsers are free to evict under
 * storage pressure. `navigator.storage.persist()` moves the origin into the
 * "persistent" bucket, where data survives until the user deletes it
 * explicitly. Chrome grants it silently to sites with meaningful engagement;
 * Firefox prompts; Safari grants based on its own heuristics.
 *
 * This is the single highest-value line of code for a local-first app, and it
 * is the reason a backend is not urgent.
 */

export interface StorageStatus {
  persisted: boolean
  /** Bytes currently used, when the browser will say. */
  usage?: number
  /** Bytes available, when the browser will say. */
  quota?: number
  supported: boolean
}

export async function requestPersistentStorage(): Promise<StorageStatus> {
  if (!('storage' in navigator) || !navigator.storage?.persist) {
    return { persisted: false, supported: false }
  }

  let persisted = await navigator.storage.persisted()
  if (!persisted) {
    try {
      persisted = await navigator.storage.persist()
    } catch {
      persisted = false
    }
  }

  let usage: number | undefined
  let quota: number | undefined
  try {
    const estimate = await navigator.storage.estimate()
    usage = estimate.usage
    quota = estimate.quota
  } catch {
    // Not available everywhere; the persisted flag is the part that matters.
  }

  return { persisted, usage, quota, supported: true }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
