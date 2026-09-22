import type { Habit } from '../domain/types'
import { toLocalDateKey } from '../domain/dates'

export interface NotificationSender {
  send(title: string, options?: { body?: string }): void
}

export interface ReminderSchedulerDeps {
  getHabits(): Habit[]
  isRemindersEnabled(): boolean
  now(): Date
  notify: NotificationSender
}

export interface ReminderScheduler {
  /** Call frequently (e.g. every 15–30s). Fires at most one notification per habit per minute. */
  tick(): void
}

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Fires a notification for each active habit whose reminder time matches the
 * current minute. Matching is exact-minute, so a reminder missed while the tab
 * was closed is never replayed. Dedupe is in-memory (habit + date + time), so
 * repeated ticks within the same minute fire once; the set resets on day rollover.
 */
export function createReminderScheduler(
  deps: ReminderSchedulerDeps,
): ReminderScheduler {
  const fired = new Set<string>()
  let lastDateKey = ''

  return {
    tick() {
      const now = deps.now()
      const dateKey = toLocalDateKey(now)
      if (dateKey !== lastDateKey) {
        fired.clear()
        lastDateKey = dateKey
      }

      if (!deps.isRemindersEnabled()) return
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      for (const habit of deps.getHabits()) {
        if (habit.archivedAt || !habit.reminderTime) continue
        if (minutesOfDay(habit.reminderTime) !== currentMinutes) continue

        const key = `${habit.id}|${dateKey}|${habit.reminderTime}`
        if (fired.has(key)) continue
        fired.add(key)

        deps.notify.send(`Habit reminder: ${habit.name}`, {
          body: habit.description ?? 'Time for your habit.',
        })
      }
    },
  }
}
