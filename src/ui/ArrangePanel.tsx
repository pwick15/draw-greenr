import clsx from 'clsx'
import { useMemo, useState } from 'react'

import { currentGaps, type AlignMode, type Axis, type DistributeMode } from '@/core/arrange'
import type { GardenObject } from '@/core/types'
import { formatDistance } from '@/core/viewport'
import { alignSelection, distributeSelection, spaceSelection } from '@/state/commands'

import {
  AlignBottomIcon,
  AlignCentreXIcon,
  AlignLeftIcon,
  AlignMiddleYIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeXIcon,
  DistributeYIcon,
} from './icons'
import { NumberInput, ToolButton } from './primitives'

const ALIGN_BUTTONS: { mode: AlignMode; label: string; Icon: typeof AlignLeftIcon }[] = [
  { mode: 'left', label: 'Align left edges', Icon: AlignLeftIcon },
  { mode: 'centreX', label: 'Align horizontal centres', Icon: AlignCentreXIcon },
  { mode: 'right', label: 'Align right edges', Icon: AlignRightIcon },
  { mode: 'top', label: 'Align top edges', Icon: AlignTopIcon },
  { mode: 'middleY', label: 'Align vertical centres', Icon: AlignMiddleYIcon },
  { mode: 'bottom', label: 'Align bottom edges', Icon: AlignBottomIcon },
]

export function ArrangePanel({ objects }: { objects: GardenObject[] }) {
  const [axis, setAxis] = useState<Axis>('x')
  const [mode, setMode] = useState<DistributeMode>('gaps')
  const [gap, setGap] = useState(0.6)

  const canDistribute = objects.length >= 3

  // Show the current spacing so "make them all 600 apart" starts from a
  // number rather than from guesswork.
  const spacing = useMemo(() => {
    const gaps = currentGaps(objects, axis)
    if (gaps.length === 0) return null
    const min = Math.min(...gaps)
    const max = Math.max(...gaps)
    return Math.abs(max - min) < 1e-6
      ? formatDistance(min)
      : `${formatDistance(min)}–${formatDistance(max)}`
  }, [objects, axis])

  return (
    <div className="flex flex-col gap-3 border-t border-stone-200 px-3 py-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Arrange {objects.length} items
      </h3>

      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BUTTONS.map(({ mode: alignMode, label, Icon }) => (
          <ToolButton key={alignMode} label={label} onClick={() => alignSelection(alignMode)} className="w-full">
            <Icon size={15} />
          </ToolButton>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <ToolButton
          label={canDistribute ? 'Distribute horizontally' : 'Needs three or more items'}
          disabled={!canDistribute}
          onClick={() => distributeSelection('x', mode)}
          className="flex-1"
        >
          <DistributeXIcon size={15} />
        </ToolButton>
        <ToolButton
          label={canDistribute ? 'Distribute vertically' : 'Needs three or more items'}
          disabled={!canDistribute}
          onClick={() => distributeSelection('y', mode)}
          className="flex-1"
        >
          <DistributeYIcon size={15} />
        </ToolButton>
        <div className="flex flex-1 gap-0.5 rounded-lg bg-stone-100 p-0.5">
          {(['gaps', 'centres'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              title={
                option === 'gaps'
                  ? 'Equal space between edges — for plants of differing spread'
                  : 'Equal centre-to-centre spacing — for posts and anything on a module'
              }
              className={clsx(
                'flex-1 rounded-md px-1 py-1 text-[10px] font-medium transition',
                mode === option ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
              )}
            >
              {option === 'gaps' ? 'Gaps' : 'Centres'}
            </button>
          ))}
        </div>
      </div>

      {/* Exact spacing: the number a planting plan is actually specified in. */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-stone-50 p-2.5 ring-1 ring-stone-200">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-stone-600">Set exact gap</span>
          {spacing && <span className="text-[10px] text-stone-400 tabular-nums">now {spacing}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 rounded-md bg-stone-200/70 p-0.5">
            {(['x', 'y'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAxis(option)}
                title={option === 'x' ? 'Space horizontally' : 'Space vertically'}
                className={clsx(
                  'rounded px-2 py-1 text-[10px] font-semibold transition',
                  axis === option ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
                )}
              >
                {option === 'x' ? 'H' : 'V'}
              </button>
            ))}
          </div>
          <NumberInput value={gap} onCommit={setGap} unit="m" className="flex-1" />
          <button
            type="button"
            onClick={() => spaceSelection(axis, gap)}
            className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-emerald-700"
          >
            Apply
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-stone-400">
          Measured edge to edge, anchored on the first item along that axis. Negative values overlap.
        </p>
      </div>
    </div>
  )
}
