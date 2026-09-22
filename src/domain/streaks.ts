import { toLocalDateKey } from './dates'
import type { Habit } from './types'

export type StreakStatus = 'done' | 'at-risk' | 'starts-today' | 'streak-lost'

export interface StreakInfo {
  streak: number
  status: StreakStatus
}

/** The local calendar day before a YYYY-MM-DD key (month/year/leap safe). */
export function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return toLocalDateKey(date)
}

/**
 * Current streak: consecutive completed days ending today if completed;
 * otherwise ending yesterday (today is pending — the chain is still alive);
 * otherwise 0 (broken or never started).
 */
export function currentStreak(
  completedDates: string[],
  today: string,
): number {
  const completed = new Set(completedDates)

  let streak = 0
  let day: string | undefined = completed.has(today)
    ? today
    : completed.has(previousDateKey(today))
      ? previousDateKey(today)
      : undefined

  while (day !== undefined && completed.has(day)) {
    streak += 1
    day = previousDateKey(day)
  }
  return streak
}

/**
 * How the habit stands relative to today:
 * - done: completed today
 * - starts-today: created today — not broken, the chain hasn't begun
 * - at-risk: not done today, but alive through yesterday
 * - streak-lost: not done today and the chain already broke
 */
export function streakStatus(habit: Habit, today: string): StreakStatus {
  if (habit.completedDates.includes(today)) return 'done'
  if (habit.createdAt >= today) return 'starts-today'
  return currentStreak(habit.completedDates, today) > 0
    ? 'at-risk'
    : 'streak-lost'
}
