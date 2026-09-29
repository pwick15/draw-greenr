/**
 * Where the sun is.
 *
 * "Does that bed get morning sun" is the question a landscaper is asked most
 * often, and no plan-view tool answers it. Every input needed is already here:
 * the plan knows what is in it, the profiles know how tall everything gets,
 * and the rest is spherical trigonometry.
 *
 * Times are **solar**, not clock: solar noon is when the sun is due south,
 * which is within about a quarter of an hour of local noon anywhere in a
 * single time zone and avoids dragging longitude, time zones and daylight
 * saving into a garden planner.
 */

const DEG = Math.PI / 180

export interface SunPosition {
  /** Degrees above the horizon. Negative means the sun has set. */
  elevation: number
  /** Compass bearing of the sun, degrees clockwise from north. */
  azimuth: number
}

/** 1 for 1 January. Leap years are ignored; the error is a fraction of a day. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  const here = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((here - start) / 86_400_000) + 1
}

/**
 * Solar declination — how far north or south of the equator the sun is
 * overhead, swinging ±23.44° over the year. Cooper's equation, which is good
 * to well under a degree and is the standard approximation for this.
 */
export function declination(day: number): number {
  return 23.44 * Math.sin(DEG * ((360 * (284 + day)) / 365))
}

export function sunPosition(day: number, solarHour: number, latitude: number): SunPosition {
  const phi = latitude * DEG
  const delta = declination(day) * DEG
  // 15 degrees an hour, zero at solar noon, negative in the morning.
  const hourAngle = (solarHour - 12) * 15 * DEG

  const sinElevation =
    Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)))

  // atan2 rather than acos: it stays well-behaved at the poles and through
  // noon, where the acos form loses its sign and puts the sun in the north.
  const azimuthFromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi),
  )

  return {
    elevation: elevation / DEG,
    azimuth: normaliseBearing(azimuthFromSouth / DEG + 180),
  }
}

export const normaliseBearing = (deg: number): number => ((deg % 360) + 360) % 360

/** Convenience for a real date, treating its hours as solar time. */
export function sunPositionAt(date: Date, latitude: number): SunPosition {
  return sunPosition(dayOfYear(date), date.getHours() + date.getMinutes() / 60, latitude)
}

/** Roughly the shortest and longest days, for a season scrubber. */
export const SOLSTICE_SUMMER = 172
export const SOLSTICE_WINTER = 355
export const EQUINOX_SPRING = 80
