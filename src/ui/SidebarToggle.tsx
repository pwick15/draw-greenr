import clsx from 'clsx'

import { ChevronIcon } from './icons'

interface SidebarToggleProps {
  side: 'left' | 'right'
  open: boolean
  onToggle: () => void
  label: string
}

/**
 * A slim tab pinned to the canvas edge. It stays in the same place whether the
 * panel is open or shut — a control that moves when you use it is one you have
 * to go looking for a second time.
 */
export function SidebarToggle({ side, open, onToggle, label }: SidebarToggleProps) {
  // Arrow always points the way the panel will go.
  const pointsRight = side === 'left' ? open : !open

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${open ? 'Hide' : 'Show'} ${label}`}
      aria-label={`${open ? 'Hide' : 'Show'} ${label}`}
      aria-expanded={open}
      className={clsx(
        'group absolute top-1/2 z-20 flex h-16 w-[18px] -translate-y-1/2 items-center justify-center',
        'bg-white/95 text-stone-400 shadow-sm ring-1 ring-stone-200 backdrop-blur',
        'transition hover:bg-white hover:text-stone-700',
        side === 'left' ? 'left-0 rounded-r-md' : 'right-0 rounded-l-md',
      )}
    >
      <ChevronIcon size={13} className={clsx('transition-transform', !pointsRight && 'rotate-180')} />
    </button>
  )
}
