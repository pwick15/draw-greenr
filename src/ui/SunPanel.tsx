import { EQUINOX_SPRING, SOLSTICE_SUMMER, SOLSTICE_WINTER, sunPosition } from '@/core/sun'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'

import { CloseIcon } from './icons'

const SEASONS = [
  { day: SOLSTICE_WINTER, label: 'Dec' },
  { day: EQUINOX_SPRING, label: 'Mar' },
  { day: SOLSTICE_SUMMER, label: 'Jun' },
  { day: 266, label: 'Sep' },
]

/** Solar hour as a clock face. */
function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const bearingName = (deg: number): string => COMPASS[Math.round(deg / 45) % 8]

/**
 * Controls for the shadow study.
 *
 * Kept on the canvas rather than in a sidebar because the whole point is to
 * scrub the time and watch the shade move across the beds — a control you have
 * to go and find is one nobody scrubs.
 */
export function SunPanel() {
  const day = useEditorStore((s) => s.sunDay)
  const hour = useEditorStore((s) => s.sunHour)
  const setSun = useEditorStore((s) => s.setSun)
  const toggle = useEditorStore((s) => s.toggle)

  const latitude = useDocStore((s) => s.doc.settings.latitude)
  const northUp = useDocStore((s) => s.doc.settings.northUp)
  const apply = useDocStore((s) => s.apply)

  const sun = sunPosition(day, hour, latitude)
  const down = sun.elevation < 1

  return (
    <div className="absolute bottom-3 left-1/2 z-20 w-[340px] -translate-x-1/2 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-stone-200 backdrop-blur">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold text-stone-700">Sun study</span>
          <span className="text-[11px] tabular-nums text-stone-500">
            {down
              ? 'below the horizon'
              : `${Math.round(sun.elevation)}° up · from the ${bearingName(sun.azimuth)}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => toggle('showShadows')}
          aria-label="Close sun study"
          className="grid h-6 w-6 place-items-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <label className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[10px] font-medium uppercase tracking-wider text-stone-400">
          Time
        </span>
        <input
          type="range"
          min={4}
          max={21}
          step={0.25}
          value={hour}
          onChange={(e) => setSun({ hour: Number(e.target.value) })}
          aria-label="Time of day"
          className="min-w-0 flex-1 accent-amber-500"
        />
        <span className="w-11 shrink-0 text-right text-[11px] font-semibold tabular-nums text-stone-700">
          {formatHour(hour)}
        </span>
      </label>

      <label className="mt-1.5 flex items-center gap-2">
        <span className="w-9 shrink-0 text-[10px] font-medium uppercase tracking-wider text-stone-400">
          Date
        </span>
        <input
          type="range"
          min={1}
          max={365}
          step={1}
          value={day}
          onChange={(e) => setSun({ day: Number(e.target.value) })}
          aria-label="Day of year"
          className="min-w-0 flex-1 accent-amber-500"
        />
        <span className="flex w-11 shrink-0 justify-end gap-1">
          {SEASONS.map((season) => (
            <button
              key={season.label}
              type="button"
              onClick={() => setSun({ day: season.day })}
              title={`Jump to ${season.label}`}
              className="text-[9px] font-medium text-stone-400 transition hover:text-amber-600"
            >
              {season.label}
            </button>
          ))}
        </span>
      </label>

      <div className="mt-2 flex items-center gap-2 border-t border-stone-200 pt-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">Site</span>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-stone-500">north</span>
          <input
            type="number"
            value={northUp}
            min={0}
            max={359}
            step={5}
            onChange={(e) =>
              apply('Set orientation', (draft) => {
                draft.settings.northUp = ((Number(e.target.value) % 360) + 360) % 360
              })
            }
            aria-label="Bearing the top of the plan points to"
            className="w-14 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] tabular-nums outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-stone-400">°</span>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-stone-500">lat</span>
          <input
            type="number"
            value={latitude}
            min={-66}
            max={66}
            step={0.5}
            onChange={(e) =>
              apply('Set latitude', (draft) => {
                draft.settings.latitude = Math.max(-66, Math.min(66, Number(e.target.value)))
              })
            }
            aria-label="Site latitude"
            className="w-16 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] tabular-nums outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-stone-400">°</span>
        </label>
      </div>

      <p className="pt-1.5 text-[9px] leading-relaxed text-stone-400">
        Solar time, so noon is when the sun is due south. Shadows come from mature heights and
        ignore anything beyond the plan.
      </p>
    </div>
  )
}
