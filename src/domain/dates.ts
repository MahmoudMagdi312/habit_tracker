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
