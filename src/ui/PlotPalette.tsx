import clsx from 'clsx'
import type { ComponentType, SVGProps } from 'react'

import type { PaintMode } from '@/core/surfaces'
import { multiPolyArea } from '@/core/geometry'
import { formatArea, formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { useEditorStore, type PlotShape } from '@/state/editor'

import { CircleIcon, PathIcon, PolygonIcon, SquareIcon } from './icons'
import { Panel } from './primitives'

const MODES: { id: PaintMode; label: string; hint: string }[] = [
  { id: 'add', label: 'Add', hint: 'Draw new ground, cutting out whatever it covers' },
  { id: 'subtract', label: 'Erase', hint: 'Cut this shape out of every material' },
  { id: 'replace', label: 'Replace', hint: 'Discard this material elsewhere and keep only the new shape' },
]

interface ShapeDef {
  id: PlotShape
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  steps: string[]
}

const SHAPES: ShapeDef[] = [
  {
    id: 'polygon',
    label: 'Freeform',
    Icon: PolygonIcon,
    steps: [
      'Click at least three corners on the plan.',
      'Hold Shift to lock edges to 15° steps.',
      'Press Enter, or click the first corner, to finish.',
    ],
  },
  {
    id: 'rect',
    label: 'Rectangle',
    Icon: SquareIcon,
    steps: [
      'Press and drag out the area.',
      'Hold Shift for a square, Alt to grow from the centre.',
      'Release to lay it down.',
    ],
  },
  {
    id: 'ellipse',
    label: 'Round',
    Icon: CircleIcon,
    steps: [
      'Press and drag out the area.',
      'Hold Shift for a circle, Alt to grow from the centre.',
      'Release to lay it down.',
    ],
  },
  {
    id: 'path',
    label: 'Path',
    Icon: PathIcon,
    steps: [
      'Click along the route — two points is enough.',
      'Set the width below; corners round off automatically.',
      'Press Enter to finish, or click the first point for a loop.',
    ],
  },
]

/** Widths a path is actually likely to be, in metres. */
const WIDTH_PRESETS = [0.6, 1, 1.5, 2, 3]

export function PlotPalette() {
  const materials = useAssetStore((s) => s.materials)
  const selected = useEditorStore((s) => s.plotMaterialId)
  const setMaterial = useEditorStore((s) => s.setPlotMaterial)
  const mode = useEditorStore((s) => s.plotMode)
  const setMode = useEditorStore((s) => s.setPlotMode)
  const shape = useEditorStore((s) => s.plotShape)
  const setShape = useEditorStore((s) => s.setPlotShape)
  const pathWidth = useEditorStore((s) => s.pathWidth)
  const setPathWidth = useEditorStore((s) => s.setPathWidth)
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const surfaces = useDocStore((s) => s.doc.surfaces)

  const areaByMaterial = new Map(surfaces.map((s) => [s.materialId, multiPolyArea(s.geometry)]))
  const active = SHAPES.find((s) => s.id === shape) ?? SHAPES[0]

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
          Shape
        </h3>
        <div className="grid grid-cols-4 gap-1">
          {SHAPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setShape(id)}
              title={label}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition',
                shape === id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800',
              )}
            >
              <Icon size={17} />
              <span className="truncate leading-none">{label}</span>
            </button>
          ))}
        </div>

        {shape === 'path' && (
          <div className="mt-2 rounded-lg bg-stone-50 p-2 ring-1 ring-stone-200">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-medium text-stone-700">Path width</span>
              <span className="text-[11px] font-semibold tabular-nums text-emerald-700">
                {formatDistance(pathWidth)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={4}
              step={0.1}
              value={pathWidth}
              onChange={(e) => setPathWidth(Number(e.target.value))}
              aria-label="Path width in metres"
              className="w-full accent-emerald-600"
            />
            <div className="flex gap-1 pt-1.5">
              {WIDTH_PRESETS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => setPathWidth(width)}
                  className={clsx(
                    'flex-1 rounded-md px-1 py-1 text-[10px] font-medium tabular-nums transition',
                    Math.abs(pathWidth - width) < 0.001
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:text-stone-800',
                  )}
                >
                  {formatDistance(width)}
                </button>
              ))}
            </div>
          </div>
        )}

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
            {tool === 'plot' ? `Drawing: ${active.label.toLowerCase()}` : `Draw a ${active.label.toLowerCase()}`}
          </p>
          <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-[10px] leading-relaxed text-stone-500">
            {active.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
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
