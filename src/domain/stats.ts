import { addDays, daysBetween } from './dates'
import { currentStreak } from './streaks'
import type { Habit } from './types'

export interface WindowStats {
  completed: number
  elapsed: number
  /** completed / elapsed; null when no elapsed days fall in the window. */
  rate: number | null
}

export interface HabitStats {
  currentStreak: number
  bestStreak: number
  last30: WindowStats
  last90: WindowStats
  lifetime: WindowStats
}

export interface AggregateStats {
  last30: WindowStats
  last90: WindowStats
  lifetime: WindowStats
}

/** Longest run of consecutive completed days anywhere in the history. */
export function bestStreak(completedDates: string[]): number {
  const sorted = [...new Set(completedDates)].sort()
  let best = 0
  let run = 0
  let previous: string | null = null

  for (const date of sorted) {
    run = previous !== null && date === addDays(previous, 1) ? run + 1 : 1
    if (run > best) best = run
    previous = date
  }
  return best
}

/**
 * Completion over [windowStart, today], floored at createdAt:
 * elapsed days = calendar days from max(windowStart, createdAt) to today.
 * Completions outside that range (before creation, or after today) don't count.
 */
export function completionWindow(
  completedDates: string[],
  windowStart: string,
  today: string,
  createdAt: string,
): WindowStats {
  const start = windowStart > createdAt ? windowStart : createdAt
  if (start > today) return { completed: 0, elapsed: 0, rate: null }

  const elapsed = daysBetween(start, today) + 1
  let completed = 0
  for (const date of completedDates) {
    if (date >= start && date <= today) completed += 1
  }
  return { completed, elapsed, rate: completed / elapsed }
}

export function habitStats(habit: Habit, today: string): HabitStats {
  return {
    currentStreak: currentStreak(habit.completedDates, today),
    bestStreak: bestStreak(habit.completedDates),
    last30: completionWindow(
      habit.completedDates,
      addDays(today, -29),
      today,
      habit.createdAt,
    ),
    last90: completionWindow(
      habit.completedDates,
      addDays(today, -89),
      today,
      habit.createdAt,
    ),
    lifetime: completionWindow(
      habit.completedDates,
      habit.createdAt,
      today,
      habit.createdAt,
    ),
  }
}

/** Pooled rate (sum of numerators / sum of denominators) over the given habits. */
export function aggregateStats(habits: Habit[], today: string): AggregateStats {
  const perHabit = habits.map((habit) => habitStats(habit, today))

  function pool(pick: (stats: HabitStats) => WindowStats): WindowStats {
    let completed = 0
    let elapsed = 0
    for (const stats of perHabit) {
      const window = pick(stats)
      completed += window.completed
      elapsed += window.elapsed
    }
    return { completed, elapsed, rate: elapsed > 0 ? completed / elapsed : null }
  }

  return {
    last30: pool((s) => s.last30),
    last90: pool((s) => s.last90),
    lifetime: pool((s) => s.lifetime),
  }
}
