/**
 * A "day" is a local calendar date (browser timezone) keyed as YYYY-MM-DD.
 * Keys produced here compare correctly with plain string comparison.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Add `days` to a YYYY-MM-DD key (calendar-date math, immune to DST). */
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}
