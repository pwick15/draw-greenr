import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'

import { zoomToFit } from '@/state/commands'
import { useDocStore } from '@/state/document'
import { relativeTime, usePlansStore } from '@/state/plans'

import { ChevronIcon, CopyIcon, PlusIcon, TrashIcon } from './icons'

export function PlansMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentId = useDocStore((s) => s.doc.id)
  const currentName = useDocStore((s) => s.doc.name)
  const plans = usePlansStore((s) => s.plans)
  const refresh = usePlansStore((s) => s.refresh)
  const openPlan = usePlansStore((s) => s.openPlan)
  const createPlan = usePlansStore((s) => s.createPlan)
  const duplicateCurrent = usePlansStore((s) => s.duplicateCurrent)
  const removePlan = usePlansStore((s) => s.removePlan)

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleOpen = async (id: string) => {
    setOpen(false)
    await openPlan(id)
    zoomToFit()
  }

  const handleNew = async () => {
    setOpen(false)
    await createPlan()
  }

  const handleDuplicate = async () => {
    setOpen(false)
    await duplicateCurrent()
  }

  const handleDelete = async (id: string, name: string, objectCount: number) => {
    const warning =
      objectCount > 0
        ? `Delete "${name}"? It has ${objectCount} item${objectCount === 1 ? '' : 's'} and this cannot be undone.`
        : `Delete "${name}"?`
    if (!window.confirm(warning)) return
    await removePlan(id)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        title="Switch between plans"
      >
        <span className="max-w-[160px] truncate">{currentName}</span>
        <ChevronIcon size={13} className={clsx('shrink-0 text-stone-400 transition-transform', open ? '-rotate-90' : 'rotate-90')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 flex w-[300px] flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10"
        >
          <div className="max-h-[320px] overflow-y-auto p-1">
            {plans.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-stone-400">No saved plans yet.</p>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  className={clsx(
                    'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition',
                    plan.id === currentId ? 'bg-emerald-600/10' : 'hover:bg-stone-100',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void handleOpen(plan.id)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span
                      className={clsx(
                        'w-full truncate text-[13px]',
                        plan.id === currentId ? 'font-medium text-emerald-800' : 'text-stone-700',
                      )}
                    >
                      {plan.name}
                    </span>
                    <span className="text-[10px] text-stone-400 tabular-nums">
                      {plan.objectCount} item{plan.objectCount === 1 ? '' : 's'}
                      {plan.surfaceCount > 0 && ` · ${plan.surfaceCount} surface${plan.surfaceCount === 1 ? '' : 's'}`}
                      {' · '}
                      {relativeTime(plan.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(plan.id, plan.name, plan.objectCount)}
                    title={`Delete ${plan.name}`}
                    aria-label={`Delete ${plan.name}`}
                    className="hidden h-6 w-6 shrink-0 place-items-center rounded-md text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 group-hover:grid"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-1 border-t border-stone-200 p-1">
            <button
              type="button"
              onClick={() => void handleNew()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <PlusIcon size={14} /> New plan
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicate()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <CopyIcon size={14} /> Duplicate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
