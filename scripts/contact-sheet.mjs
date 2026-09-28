#!/usr/bin/env node
/**
 * Builds a single SVG contact sheet of every generated asset, for eyeballing
 * the library after a regeneration. `node scripts/contact-sheet.mjs [out.svg]`
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.cwd(), process.argv[2] ?? 'contact-sheet.svg')

const CELL = 150
const PAD = 12
const LABEL = 16
const COLS = 9

function collect(dir, prefix) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => ({ id: `${prefix}-${basename(f, '.svg')}`, name: basename(f, '.svg'), file: resolve(dir, f) }))
}

const files = [
  ...collect(resolve(ROOT, 'public/assets/materials'), 'm'),
  ...collect(resolve(ROOT, 'public/assets/items'), 'i'),
]

const cells = files.map((entry, index) => {
  const raw = readFileSync(entry.file, 'utf8')
  const open = raw.match(/<svg[^>]*>/)?.[0] ?? ''
  const viewBox = open.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100'
  let inner = raw.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

  // Every file defines its own `sh`, `sun`, ... — namespace them so that
  // merging into one document does not cross-wire the filters.
  const ns = `a${index}_`
  inner = inner.replace(/id="([^"]+)"/g, (_, id) => `id="${ns}${id}"`)
  inner = inner.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ns}${id})`)

  const col = index % COLS
  const row = Math.floor(index / COLS)
  const x = PAD + col * (CELL + PAD)
  const y = PAD + row * (CELL + PAD + LABEL)
  const [, , vw, vh] = viewBox.split(/\s+/).map(Number)
  // Letterbox inside the cell so aspect ratios stay honest.
  const k = Math.min(CELL / vw, CELL / vh)
  const w = vw * k
  const h = vh * k

  return (
    `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#ffffff" stroke="#d8dcd6"/>` +
    `<svg x="${(x + (CELL - w) / 2).toFixed(1)}" y="${(y + (CELL - h) / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${viewBox}" overflow="visible">${inner}</svg>` +
    `<text x="${x + CELL / 2}" y="${y + CELL + 12}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10" fill="#4a544c" text-anchor="middle">${entry.name}</text>`
  )
})

const rows = Math.ceil(files.length / COLS)
const width = PAD + COLS * (CELL + PAD)
const height = PAD + rows * (CELL + PAD + LABEL)

writeFileSync(
  out,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#eef1ec"/>${cells.join('')}</svg>\n`,
)

console.log(`${files.length} assets -> ${out} (${width}x${height})`)
