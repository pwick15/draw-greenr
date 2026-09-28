/**
 * Custom asset import.
 *
 * The whole point of the tool: drop in any image and have it behave exactly
 * like a built-in — correctly scaled in metres, alpha-accurate to click, and
 * stacked in the right band. That means the import has to do real work up
 * front: trim the dead margin, optionally knock out a flat background, cap the
 * resolution, and render a thumbnail.
 */

export interface ImportOptions {
  /** Knock out a flat background by flooding inwards from the border. */
  removeBackground: boolean
  /** Colour distance that still counts as background, 0..1. */
  tolerance: number
  /** Crop away fully transparent margins. */
  trim: boolean
  /** Soften the cut edge, in pixels. */
  feather: number
  /** Cap on the longest edge, in pixels. */
  maxSize: number
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  removeBackground: false,
  tolerance: 0.12,
  trim: true,
  feather: 1,
  maxSize: 1024,
}

export interface ImportResult {
  /** Processed artwork, ready to store. */
  blob: Blob
  mime: string
  thumb: Blob
  width: number
  height: number
  /** Fraction of pixels that are not fully opaque, before any processing. */
  hadAlpha: boolean
  /** Object URL for previewing in the import dialog. Revoke when done. */
  previewUrl: string
}

export const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif']

export function isSupportedFile(file: File): boolean {
  return SUPPORTED_TYPES.includes(file.type) || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file.name)
}

function loadFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode that image.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed.'))), type, quality)
  })
}

// ---------------------------------------------------------------------------
// Background removal
// ---------------------------------------------------------------------------

/**
 * Flood inwards from the border, clearing anything close in colour to the
 * sampled background. Scanline flood fill, so a 1024x1024 image stays well
 * under a frame even in the worst case.
 */
function removeBackground(data: ImageData, tolerance: number): void {
  const { width, height, data: px } = data

  // Estimate the background from the border, not just one corner: a photo with
  // a vignette or a gradient backdrop has no single representative pixel.
  let br = 0
  let bg = 0
  let bb = 0
  let n = 0
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4
    br += px[i]
    bg += px[i + 1]
    bb += px[i + 2]
    n++
  }
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64))) {
    sample(x, 0)
    sample(x, height - 1)
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 64))) {
    sample(0, y)
    sample(width - 1, y)
  }
  br /= n
  bg /= n
  bb /= n

  const maxDist = tolerance * 441.67 // sqrt(3 * 255^2)
  const visited = new Uint8Array(width * height)
  const stack: number[] = []

  const matches = (idx: number) => {
    const i = idx * 4
    if (px[i + 3] === 0) return true
    const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb)
    return d <= maxDist
  }

  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1)
  }

  while (stack.length) {
    const idx = stack.pop()!
    if (visited[idx]) continue
    visited[idx] = 1
    if (!matches(idx)) continue
    px[idx * 4 + 3] = 0

    const x = idx % width
    const y = (idx / width) | 0
    if (x > 0) stack.push(idx - 1)
    if (x < width - 1) stack.push(idx + 1)
    if (y > 0) stack.push(idx - width)
    if (y < height - 1) stack.push(idx + width)
  }
}

/** Average alpha with its neighbours, so the cut edge is not a staircase. */
function featherAlpha(data: ImageData, radius: number): void {
  if (radius <= 0) return
  const { width, height, data: px } = data
  const src = new Uint8Array(width * height)
  for (let i = 0, j = 3; i < src.length; i++, j += 4) src[i] = px[j]

  const r = Math.round(radius)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      // Only soften pixels that sit on a boundary; interiors keep crisp alpha.
      const a = src[idx]
      if (a === 0 || a === 255) {
        let boundary = false
        for (let dy = -1; dy <= 1 && !boundary; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            if (src[ny * width + nx] !== a) {
              boundary = true
              break
            }
          }
        }
        if (!boundary) continue
      }
      let sum = 0
      let count = 0
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          sum += src[ny * width + nx]
          count++
        }
      }
      px[idx * 4 + 3] = Math.round(sum / count)
    }
  }
}

/** Bounds of everything that is not fully transparent. */
function alphaBounds(data: ImageData, threshold = 4) {
  const { width, height, data: px } = data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function processImport(file: File, options: Partial<ImportOptions> = {}): Promise<ImportResult> {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options }
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)

  const img = await loadFromBlob(file)
  const naturalW = img.naturalWidth || img.width
  const naturalH = img.naturalHeight || img.height
  if (!naturalW || !naturalH) throw new Error('That image has no intrinsic size.')

  // Vector art is stored untouched — rasterising it would throw away the one
  // property that makes it better than a PNG at high zoom.
  if (isSvg && !opts.removeBackground) {
    const thumb = await renderThumb(img, 192)
    return {
      blob: file,
      mime: 'image/svg+xml',
      thumb,
      width: naturalW,
      height: naturalH,
      hadAlpha: true,
      previewUrl: URL.createObjectURL(file),
    }
  }

  const k = Math.min(1, opts.maxSize / Math.max(naturalW, naturalH))
  const w = Math.max(1, Math.round(naturalW * k))
  const h = Math.max(1, Math.round(naturalH * k))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')
  ctx.drawImage(img, 0, 0, w, h)

  let data = ctx.getImageData(0, 0, w, h)
  let hadAlpha = false
  for (let i = 3; i < data.data.length; i += 4) {
    if (data.data[i] < 250) {
      hadAlpha = true
      break
    }
  }

  if (opts.removeBackground) {
    removeBackground(data, opts.tolerance)
    featherAlpha(data, opts.feather)
  }
  ctx.putImageData(data, 0, 0)

  let outCanvas = canvas
  if (opts.trim) {
    const bounds = alphaBounds(data)
    if (bounds && (bounds.w !== w || bounds.h !== h)) {
      const trimmed = document.createElement('canvas')
      trimmed.width = bounds.w
      trimmed.height = bounds.h
      const tctx = trimmed.getContext('2d')
      if (tctx) {
        tctx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h)
        outCanvas = trimmed
        data = tctx.getImageData(0, 0, bounds.w, bounds.h)
      }
    }
  }

  const blob = await canvasToBlob(outCanvas, 'image/png')
  const thumb = await renderThumbFromCanvas(outCanvas, 192)
  return {
    blob,
    mime: 'image/png',
    thumb,
    width: outCanvas.width,
    height: outCanvas.height,
    hadAlpha,
    previewUrl: URL.createObjectURL(blob),
  }
}

async function renderThumb(img: HTMLImageElement, size: number): Promise<Blob> {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const k = Math.min(1, size / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * k))
  canvas.height = Math.max(1, Math.round(h * k))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvasToBlob(canvas)
}

async function renderThumbFromCanvas(source: HTMLCanvasElement, size: number): Promise<Blob> {
  const k = Math.min(1, size / Math.max(source.width, source.height))
  if (k === 1) return canvasToBlob(source)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * k))
  canvas.height = Math.max(1, Math.round(source.height * k))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  }
  return canvasToBlob(canvas)
}

/**
 * Suggest a real-world size. Most garden artwork is roughly square and roughly
 * plant-sized, so 2 m is a better first guess than anything derived from the
 * pixel dimensions — but the aspect ratio is always respected.
 */
export function suggestSize(width: number, height: number, widthMeters = 2): { w: number; h: number } {
  const aspect = height / width
  return { w: widthMeters, h: Math.round(widthMeters * aspect * 100) / 100 }
}
