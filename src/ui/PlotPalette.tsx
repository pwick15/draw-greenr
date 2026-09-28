import clsx from 'clsx'

import type { PaintMode } from '@/core/surfaces'
import { multiPolyArea } from '@/core/geometry'
import { formatArea } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'

import { Panel } from './primitives'

const MODES: { id: PaintMode; label: string; hint: string }[] = [
  { id: 'add', label: 'Add', hint: 'Draw new ground, cutting out whatever it covers' },
  { id: 'subtract', label: 'Erase', hint: 'Cut this shape out of every material' },
  { id: 'replace', label: 'Replace', hint: 'Discard this material elsewhere and keep only the new shape' },
]

export function PlotPalette() {
  const materials = useAssetStore((s) => s.materials)
  const selected = useEditorStore((s) => s.plotMaterialId)
  const setMaterial = useEditorStore((s) => s.setPlotMaterial)
  const mode = useEditorStore((s) => s.plotMode)
  const setMode = useEditorStore((s) => s.setPlotMode)
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const surfaces = useDocStore((s) => s.doc.surfaces)

  const areaByMaterial = new Map(surfaces.map((s) => [s.materialId, multiPolyArea(s.geometry)]))

  return (
    <Panel title="Ground materials" className="min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-3 gap-1.5">
          {[...materials.values()].map((material) => {
            const active = material.id === selected
            const area = areaByMaterial.get(material.id)
            return (
              <button
                key={material.id}
                type="button"
                onClick={() => setMaterial(material.id)}
                title={area ? `${material.name} — ${formatArea(area)} in this plan` : material.name}
                className={clsx(
                  'group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition',
                  active
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-transparent hover:border-stone-200 hover:bg-stone-50',
                )}
              >
                <span
                  className="relative aspect-square w-full overflow-hidden rounded-md ring-1 ring-black/10"
                  style={{
                    background: material.textureSrc
                      ? `url(${material.textureSrc}) center / 130% no-repeat`
                      : material.fill,
                    backgroundColor: material.fill,
                  }}
                >
                  {area !== undefined && area > 0 && (
                    <span className="absolute inset-x-0 bottom-0 bg-stone-900/65 py-0.5 text-center text-[8px] font-medium leading-none text-white tabular-nums">
                      {formatArea(area)}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight text-stone-600 group-hover:text-stone-900">
                  {material.name}
                </span>
              </button>
            )
          })}
        </div>

        <h3 className="px-0.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Mode
        </h3>
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              title={item.hint}
              className={clsx(
                'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition',
                mode === item.id
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="px-0.5 pt-2 text-[10px] leading-relaxed text-stone-400">
          {MODES.find((m) => m.id === mode)?.hint}
        </p>

        <div className="mt-4 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
          <p className="text-[11px] font-medium text-stone-700">
            {tool === 'plot' ? 'Drawing a plot' : 'Draw a plot'}
          </p>
          <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-[10px] leading-relaxed text-stone-500">
            <li>Click at least three corners on the plan.</li>
            <li>Hold Shift to lock edges to 15° steps.</li>
            <li>Press Enter, or click the first corner, to finish.</li>
          </ol>
          {tool !== 'plot' && (
            <button
              type="button"
              onClick={() => setTool('plot')}
              className="mt-2 w-full rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-emerald-700"
            >
              Start drawing
            </button>
          )}
        </div>
      </div>
    </Panel>
  )
}
