import { toLocalDateKey } from './dates'
import type { Habit } from './types'

export type CellState = 'completed' | 'missed' | 'today' | 'future' | 'blocked'

export interface CalendarCell {
  /** Local date key, YYYY-MM-DD. */
  date: string
  /** Day of month. */
  day: number
  state: CellState
  /** True when clicking can toggle: on/after createdAt and not after today. */
  toggleable: boolean
}

export interface CalendarMonth {
  year: number
  /** 0-based, like Date's monthIndex. */
  monthIndex: number
  /** Leading nulls pad the grid to the first weekday of the month. */
  cells: (CalendarCell | null)[]
}

/**
 * Builds a month grid for a habit relative to `today`:
 * - blocked: before the habit existed (never toggleable)
 * - completed: checked off
 * - missed: past and unchecked
 * - today: the current day, still unchecked
 * - future: after today
 */
export function buildCalendar(
  habit: Habit,
  today: string,
  year: number,
  monthIndex: number,
): CalendarMonth {
  const leadingBlanks = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const completed = new Set(habit.completedDates)

  const cells: (CalendarCell | null)[] = Array.from(
    { length: leadingBlanks },
    () => null,
  )

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toLocalDateKey(new Date(year, monthIndex, day))
    let state: CellState
    if (date < habit.createdAt) state = 'blocked'
    else if (date > today) state = 'future'
    else if (completed.has(date)) state = 'completed'
    else if (date === today) state = 'today'
    else state = 'missed'

    const toggleable = date >= habit.createdAt && date <= today
    cells.push({ date, day, state, toggleable })
  }

  return { year, monthIndex, cells }
}
