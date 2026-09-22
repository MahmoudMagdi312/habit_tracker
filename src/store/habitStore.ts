import type { CreateHabitInput, Habit, HabitStoreState } from '../domain/types'
import { toLocalDateKey } from '../domain/dates'
import { currentStreak, streakStatus } from '../domain/streaks'
import type { StreakInfo } from '../domain/streaks'
import { buildCalendar } from '../domain/calendar'
import type { CalendarMonth } from '../domain/calendar'
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

  let state: HabitStoreState = { habits: loadState(storage).habits }
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
      const habit: Habit = {
        id: newId(),
        name,
        ...(description ? { description } : {}),
        icon: input.icon?.trim() || '🎯',
        color: input.color?.trim() || '#3b82f6',
        createdAt: toLocalDateKey(now()),
        completedDates: [],
      }
      commit({ habits: [...state.habits, habit] })
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
    updateHabit(id, input) {
      const existing = state.habits.find((h) => h.id === id)
      if (!existing) return
      const name = input.name.trim()
      if (!name) throw new Error('Habit name is required')
      const description = input.description?.trim()

      const { description: _oldDescription, ...rest } = existing
      const updated: Habit = {
        ...rest,
        name,
        icon: input.icon?.trim() || existing.icon,
        color: input.color?.trim() || existing.color,
        ...(description ? { description } : {}),
      }
      commit({
        habits: state.habits.map((h) => (h.id === id ? updated : h)),
      })
    },
    archiveHabit(id) {
      if (!state.habits.some((h) => h.id === id && !h.archivedAt)) return
      commit({
        habits: state.habits.map((h) =>
          h.id === id && !h.archivedAt
            ? { ...h, archivedAt: toLocalDateKey(now()) }
            : h,
        ),
      })
    },
    deleteHabit(id) {
      if (!state.habits.some((h) => h.id === id)) return
      commit({ habits: state.habits.filter((h) => h.id !== id) })
    },
  }
}
