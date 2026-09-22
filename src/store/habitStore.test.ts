import { describe, it, expect, vi } from 'vitest'
import { createHabitStore } from './habitStore'
import { SCHEMA_VERSION } from '../storage/storage'
import type { StorageAdapter } from '../storage/storage'

interface MemoryStorage extends StorageAdapter {
  raw: string | null
}

function createMemoryStorage(): MemoryStorage {
  const storage: MemoryStorage = {
    raw: null,
    read: () => storage.raw,
    write: (value) => {
      storage.raw = value
    },
  }
  return storage
}

// Fixed clock: local time, Sep 23 2026 10:30
const NOW = new Date(2026, 8, 23, 10, 30)
const TODAY = '2026-09-23'

function makeStore(overrides: {
  storage?: MemoryStorage
  now?: () => Date
} = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const store = createHabitStore({
    storage,
    now: overrides.now ?? (() => NOW),
    newId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  return { store, storage }
}

describe('createHabit', () => {
  it('creates a habit with trimmed name, defaults, and today as createdAt', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: '  Drink water  ' })

    expect(habit.name).toBe('Drink water')
    expect(habit.icon).toBe('🎯')
    expect(habit.color).toBe('#3b82f6')
    expect(habit.createdAt).toBe(TODAY)
    expect(habit.completedDates).toEqual([])
    expect(store.getState().habits).toHaveLength(1)
  })

  it('accepts description, icon, and color when provided', () => {
    const { store } = makeStore()
    const habit = store.createHabit({
      name: 'Read',
      description: '  10 pages  ',
      icon: '📖',
      color: '#22c55e',
    })

    expect(habit.description).toBe('10 pages')
    expect(habit.icon).toBe('📖')
    expect(habit.color).toBe('#22c55e')
  })

  it('throws on a blank name', () => {
    const { store } = makeStore()
    expect(() => store.createHabit({ name: '   ' })).toThrow(
      'Habit name is required',
    )
    expect(store.getState().habits).toHaveLength(0)
  })
})

describe('toggleCompletion', () => {
  it('adds today, then removes it on the second toggle', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Stretch' })

    store.toggleCompletion(habit.id)
    expect(store.getState().habits[0].completedDates).toEqual([TODAY])

    store.toggleCompletion(habit.id)
    expect(store.getState().habits[0].completedDates).toEqual([])
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Stretch' })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.toggleCompletion(habit.id)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.toggleCompletion(habit.id)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores dates before the habit was created', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Stretch' })

    store.toggleCompletion(habit.id, '2026-09-22')
    expect(store.getState().habits[0].completedDates).toEqual([])
  })

  it('is a no-op for unknown ids', () => {
    const { store } = makeStore()
    store.createHabit({ name: 'Stretch' })
    const before = store.getState()

    store.toggleCompletion('nope')
    expect(store.getState()).toBe(before)
  })

  it('uses the injected clock for the default date', () => {
    const { store } = makeStore({ now: () => new Date(2026, 0, 5, 23, 59) })
    const habit = store.createHabit({ name: 'NY resolution' })

    expect(habit.createdAt).toBe('2026-01-05')
    store.toggleCompletion(habit.id)
    expect(store.getState().habits[0].completedDates).toEqual(['2026-01-05'])
  })
})

describe('persistence', () => {
  it('writes a versioned payload on every mutation', () => {
    const { store, storage } = makeStore()
    store.createHabit({ name: 'Meditate' })

    const parsed = JSON.parse(storage.raw!)
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.habits).toHaveLength(1)
    expect(parsed.habits[0].name).toBe('Meditate')
  })

  it('rehydrates habits from storage ("survives reload")', () => {
    const { store, storage } = makeStore()
    const habit = store.createHabit({ name: 'Meditate' })
    store.toggleCompletion(habit.id)

    const reloaded = createHabitStore({
      storage,
      now: () => NOW,
      newId: () => 'other-id',
    })
    expect(reloaded.getState().habits).toHaveLength(1)
    expect(reloaded.getState().habits[0].name).toBe('Meditate')
    expect(reloaded.getState().habits[0].completedDates).toEqual([TODAY])
  })

  it('starts empty when stored JSON is corrupt', () => {
    const storage = createMemoryStorage()
    storage.raw = '{not json'
    const { store } = makeStore({ storage })
    expect(store.getState().habits).toEqual([])
  })

  it('starts empty when the stored schema version is from the future', () => {
    const storage = createMemoryStorage()
    storage.raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 1,
      habits: [],
    })
    const { store } = makeStore({ storage })
    expect(store.getState().habits).toEqual([])
  })
})

describe('streaks through the store (fake clock)', () => {
  it('keeps a check-off made just before midnight on the correct day', () => {
    let clock = new Date(2026, 8, 23, 23, 59)
    const { store } = makeStore({ now: () => clock })
    const habit = store.createHabit({ name: 'Late night' })
    store.toggleCompletion(habit.id)
    expect(store.getToday()).toBe('2026-09-23')

    // Cross local midnight: yesterday's check-off keeps the chain alive.
    clock = new Date(2026, 8, 24, 0, 1)
    expect(store.getToday()).toBe('2026-09-24')
    expect(store.getStreakInfo(habit.id)).toEqual({
      streak: 1,
      status: 'at-risk',
    })

    // Completing today extends it to 2.
    store.toggleCompletion(habit.id)
    expect(store.getStreakInfo(habit.id)).toEqual({
      streak: 2,
      status: 'done',
    })
  })

  it('reports starts-today for a habit created today with no check-off', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Fresh' })
    expect(store.getStreakInfo(habit.id)).toEqual({
      streak: 0,
      status: 'starts-today',
    })
  })

  it('returns null for unknown ids', () => {
    const { store } = makeStore()
    expect(store.getStreakInfo('nope')).toBeNull()
  })
})

describe('habit management', () => {
  it('updates name, icon, color, and description and persists the change', () => {
    const { store, storage } = makeStore()
    const habit = store.createHabit({ name: 'Yoga' })

    store.updateHabit(habit.id, {
      name: '  Power yoga  ',
      description: ' Morning flow ',
      icon: '🧘',
      color: '#a855f7',
    })

    const updated = store.getState().habits[0]
    expect(updated.name).toBe('Power yoga')
    expect(updated.description).toBe('Morning flow')
    expect(updated.icon).toBe('🧘')
    expect(updated.color).toBe('#a855f7')

    const reloaded = createHabitStore({ storage, now: () => NOW })
    expect(reloaded.getState().habits[0].name).toBe('Power yoga')
  })

  it('clears the description when an empty one is given', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Yoga', description: 'old note' })
    store.updateHabit(habit.id, { name: 'Yoga', description: '   ' })
    expect(store.getState().habits[0].description).toBeUndefined()
  })

  it('throws on a blank name and leaves state untouched', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Yoga' })
    const before = store.getState()
    expect(() => store.updateHabit(habit.id, { name: '  ' })).toThrow(
      'Habit name is required',
    )
    expect(store.getState()).toBe(before)
  })

  it('is a no-op for unknown ids', () => {
    const { store } = makeStore()
    store.createHabit({ name: 'Yoga' })
    const before = store.getState()
    store.updateHabit('nope', { name: 'Other' })
    store.archiveHabit('nope')
    store.deleteHabit('nope')
    expect(store.getState()).toBe(before)
  })

  it('archives with today as archivedAt, keeping history intact', () => {
    const { store, storage } = makeStore()
    const habit = store.createHabit({ name: 'Yoga' })
    store.toggleCompletion(habit.id)

    store.archiveHabit(habit.id)

    const archived = store.getState().habits[0]
    expect(archived.archivedAt).toBe(TODAY)
    expect(archived.completedDates).toEqual([TODAY])

    const reloaded = createHabitStore({ storage, now: () => NOW })
    expect(reloaded.getState().habits[0].archivedAt).toBe(TODAY)
  })

  it('does not re-archive (date stays at the first archive day)', () => {
    let clock = new Date(2026, 8, 23, 10, 0)
    const { store } = makeStore({ now: () => clock })
    const habit = store.createHabit({ name: 'Yoga' })
    store.archiveHabit(habit.id)

    clock = new Date(2026, 8, 25, 10, 0)
    store.archiveHabit(habit.id)
    expect(store.getState().habits[0].archivedAt).toBe('2026-09-23')
  })

  it('deletes a habit and its history permanently, persisted to storage', () => {
    const { store, storage } = makeStore()
    const habit = store.createHabit({ name: 'Yoga' })
    store.toggleCompletion(habit.id)

    store.deleteHabit(habit.id)

    expect(store.getState().habits).toEqual([])
    const parsed = JSON.parse(storage.raw!)
    expect(parsed.habits).toEqual([])
  })
})
