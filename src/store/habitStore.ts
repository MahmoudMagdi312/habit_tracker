import type { CreateHabitInput, Habit, HabitStoreState } from '../domain/types'
import { toLocalDateKey } from '../domain/dates'
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
  }
}
