import type { CreateHabitInput, Habit, HabitStoreState } from '../domain/types'
import { toLocalDateKey } from '../domain/dates'
import { currentStreak, streakStatus } from '../domain/streaks'
import type { StreakInfo } from '../domain/streaks'
import { buildCalendar } from '../domain/calendar'
import type { CalendarMonth } from '../domain/calendar'
import { aggregateStats, habitStats } from '../domain/stats'
import type { AggregateStats, HabitStats } from '../domain/stats'
import {
  createLocalStorageAdapter,
  loadState,
  saveState,
} from '../storage/storage'
import type { StorageAdapter } from '../storage/storage'

export interface HabitStore {
  /** Current state; returns a stable reference until a mutation occurs. */
  getState(): HabitStoreState
  subscribe(listener: () => void): () => void
  /** Today's local date key, using the store's clock. */
  getToday(): string
  createHabit(input: CreateHabitInput): Habit
  /** Toggles completion for a date (defaults to today). No-op for dates before createdAt or unknown ids. */
  toggleCompletion(id: string, date?: string): void
  /** Streak count + status for a habit, using the store's clock. Null for unknown ids. */
  getStreakInfo(id: string): StreakInfo | null
  /** Month grid for a habit (0-based monthIndex), using the store's clock. Null for unknown ids. */
  getCalendar(id: string, year: number, monthIndex: number): CalendarMonth | null
  /** Streaks + completion windows for a habit, using the store's clock. Null for unknown ids. */
  getStats(id: string): HabitStats | null
  /** Pooled completion windows across active (non-archived) habits. */
  getAggregateStats(): AggregateStats
  /** Global reminders on/off (persisted; per-habit times are untouched). */
  isRemindersEnabled(): boolean
  setRemindersEnabled(enabled: boolean): void
  /** Updates name/description/icon/color. Throws on a blank name; no-op for unknown ids. */
  updateHabit(id: string, input: CreateHabitInput): void
  /** Archives a habit (hides it from Today, keeps history). No-op if already archived or unknown. */
  archiveHabit(id: string): void
  /** Permanently removes a habit and its history. No-op for unknown ids. */
  deleteHabit(id: string): void
}

export interface StoreDependencies {
  storage?: StorageAdapter
  now?: () => Date
  newId?: () => string
}

/** Trims a reminder time and validates the HH:MM shape; empty → undefined. */
function normalizeReminderTime(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) {
    throw new Error('Reminder time must look like HH:MM')
  }
  return trimmed
}

function defaultNewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `habit_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function createHabitStore(deps: StoreDependencies = {}): HabitStore {
  const storage = deps.storage ?? createLocalStorageAdapter()
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? defaultNewId

  const persisted = loadState(storage)
  let state: HabitStoreState = {
    habits: persisted.habits,
    remindersEnabled: persisted.remindersEnabled,
  }
  const listeners = new Set<() => void>()

  function commit(next: HabitStoreState): void {
    state = next
    saveState(storage, state)
    for (const listener of listeners) listener()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getToday: () => toLocalDateKey(now()),
    createHabit(input) {
      const name = input.name.trim()
      if (!name) throw new Error('Habit name is required')
      const description = input.description?.trim()
      const reminderTime = normalizeReminderTime(input.reminderTime)
      const habit: Habit = {
        id: newId(),
        name,
        ...(description ? { description } : {}),
        icon: input.icon?.trim() || '🎯',
        color: input.color?.trim() || '#3b82f6',
        ...(reminderTime ? { reminderTime } : {}),
        createdAt: toLocalDateKey(now()),
        completedDates: [],
      }
      commit({ ...state, habits: [...state.habits, habit] })
      return habit
    },
    toggleCompletion(id, date = toLocalDateKey(now())) {
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return
      if (date < habit.createdAt) return
      const completedDates = habit.completedDates.includes(date)
        ? habit.completedDates.filter((d) => d !== date)
        : [...habit.completedDates, date]
      commit({
        ...state,
        habits: state.habits.map((h) =>
          h.id === id ? { ...h, completedDates } : h,
        ),
      })
    },
    getStreakInfo(id) {
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return null
      const today = toLocalDateKey(now())
      return {
        streak: currentStreak(habit.completedDates, today),
        status: streakStatus(habit, today),
      }
    },
    getCalendar(id, year, monthIndex) {
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return null
      return buildCalendar(habit, toLocalDateKey(now()), year, monthIndex)
    },
    getStats(id) {
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return null
      return habitStats(habit, toLocalDateKey(now()))
    },
    getAggregateStats() {
      const active = state.habits.filter((h) => !h.archivedAt)
      return aggregateStats(active, toLocalDateKey(now()))
    },
    isRemindersEnabled: () => state.remindersEnabled,
    setRemindersEnabled(enabled) {
      if (state.remindersEnabled === enabled) return
      commit({ ...state, remindersEnabled: enabled })
    },
    updateHabit(id, input) {
      const existing = state.habits.find((h) => h.id === id)
      if (!existing) return
      const name = input.name.trim()
      if (!name) throw new Error('Habit name is required')
      const description = input.description?.trim()
      const reminderTime = normalizeReminderTime(input.reminderTime)

      const { description: _oldDescription, reminderTime: _oldReminder, ...rest } =
        existing
      const updated: Habit = {
        ...rest,
        name,
        icon: input.icon?.trim() || existing.icon,
        color: input.color?.trim() || existing.color,
        ...(description ? { description } : {}),
        ...(reminderTime ? { reminderTime } : {}),
      }
      commit({
        ...state,
        habits: state.habits.map((h) => (h.id === id ? updated : h)),
      })
    },
    archiveHabit(id) {
      if (!state.habits.some((h) => h.id === id && !h.archivedAt)) return
      commit({
        ...state,
        habits: state.habits.map((h) =>
          h.id === id && !h.archivedAt
            ? { ...h, archivedAt: toLocalDateKey(now()) }
            : h,
        ),
      })
    },
    deleteHabit(id) {
      if (!state.habits.some((h) => h.id === id)) return
      commit({ ...state, habits: state.habits.filter((h) => h.id !== id) })
    },
  }
}
