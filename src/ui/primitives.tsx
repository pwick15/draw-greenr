import clsx from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { CloseIcon } from './icons'

// ---------------------------------------------------------------------------

type ToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  label: string
  shortcut?: string
  children: ReactNode
}

export function ToolButton({ active, label, shortcut, children, className, ...rest }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={shortcut ? `${label}  (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'grid h-9 w-9 place-items-center rounded-lg text-stone-600 transition',
        'hover:bg-stone-100 hover:text-stone-900',
        'disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/25',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-emerald-600 text-white hover:bg-emerald-700',
        variant === 'secondary' &&
          'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 hover:text-stone-900',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('flex min-h-0 flex-col', className)}>
      {title && (
        <header className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-stone-500">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
    </label>
  )
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: number
  onCommit: (value: number) => void
  /** Suffix shown inside the field, e.g. "m". */
  unit?: string
  precision?: number
}

/**
 * Numeric field that only writes back on blur or Enter, so typing "12" into a
 * width does not briefly resize the object to 1 metre on the way there.
 */
export function NumberInput({ value, onCommit, unit, precision = 2, className, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState(() => format(value, precision))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(format(value, precision))
  }, [value, precision])

  const commit = () => {
    const parsed = Number.parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(parsed)) onCommit(parsed)
    else setDraft(format(value, precision))
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          focused.current = true
          e.target.select()
        }}
        onBlur={() => {
          focused.current = false
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setDraft(format(value, precision))
            e.currentTarget.blur()
          }
        }}
        className={clsx(
          'w-full rounded-md bg-white px-2 py-1.5 text-sm text-stone-800 tabular-nums ring-1 ring-stone-300',
          'outline-none focus:ring-2 focus:ring-emerald-500',
          unit && 'pr-7',
          className,
        )}
        {...rest}
      />
      {unit && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-stone-400">
          {unit}
        </span>
      )}
    </div>
  )
}

function format(value: number, precision: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(Number(value.toFixed(precision)))
}

// ---------------------------------------------------------------------------

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      className={clsx(
        'w-full rounded-md bg-white px-2 py-1.5 text-sm text-stone-800 ring-1 ring-stone-300',
        'outline-none focus:ring-2 focus:ring-emerald-500',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'w-full rounded-md bg-white px-2 py-1.5 text-sm text-stone-800 ring-1 ring-stone-300',
        'outline-none focus:ring-2 focus:ring-emerald-500',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-600"
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-stone-600">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-emerald-600' : 'bg-stone-300',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/40 p-6" onPointerDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        className={clsx(
          'flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
          wide ? 'max-w-3xl' : 'max-w-md',
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint && <p className="text-xs leading-relaxed text-stone-400">{hint}</p>}
      {action}
    </div>
  )
}
