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

describe('getCalendar', () => {
  it('builds month cells with states from the store clock', () => {
    let clock = new Date(2026, 8, 21, 9, 0)
    const { store } = makeStore({ now: () => clock })
    const habit = store.createHabit({ name: 'Run' })
    store.toggleCompletion(habit.id) // completed Sep 21

    clock = new Date(2026, 8, 23, 9, 0) // now Sep 23
    const calendar = store.getCalendar(habit.id, 2026, 8)
    expect(calendar).not.toBeNull()

    const cellOf = (day: number) =>
      calendar!.cells.find((c) => c?.day === day)!

    expect(cellOf(5).state).toBe('blocked')
    expect(cellOf(5).toggleable).toBe(false)
    expect(cellOf(21).state).toBe('completed')
    expect(cellOf(22).state).toBe('missed')
    expect(cellOf(22).toggleable).toBe(true)
    expect(cellOf(23).state).toBe('today')
    expect(cellOf(26).state).toBe('future')
    expect(cellOf(26).toggleable).toBe(false)
    // Sep 1 2026 is a Tuesday → two leading blanks
    expect(calendar!.cells[0]).toBeNull()
    expect(calendar!.cells[1]).toBeNull()
    expect(calendar!.cells[2]?.day).toBe(1)
  })

  it('returns null for unknown ids', () => {
    const { store } = makeStore()
    expect(store.getCalendar('nope', 2026, 8)).toBeNull()
  })
})

describe('getStats / getAggregateStats', () => {
  function seedStore() {
    let clock = new Date(2026, 8, 1, 12, 0)
    const { store } = makeStore({ now: () => clock })
    const run = store.createHabit({ name: 'Run', icon: '🏃' })
    const meditate = store.createHabit({ name: 'Meditate', icon: '🧘' })

    // Both complete Sep 1–3; only Meditate continues through Sep 23.
    for (let day = 1; day <= 3; day++) {
      clock = new Date(2026, 8, day, 20, 0)
      store.toggleCompletion(run.id)
      store.toggleCompletion(meditate.id)
    }
    for (let day = 4; day <= 23; day++) {
      clock = new Date(2026, 8, day, 20, 0)
      store.toggleCompletion(meditate.id)
    }
    clock = new Date(2026, 8, 23, 21, 0)
    return { store, run, meditate }
  }

  it('computes per-habit stats with the store clock', () => {
    const { store, run } = seedStore()
    const stats = store.getStats(run.id)!

    expect(stats.currentStreak).toBe(0) // broke after Sep 3
    expect(stats.bestStreak).toBe(3)
    expect(stats.last30.completed).toBe(3)
    expect(stats.last90.completed).toBe(3)
    expect(stats.lifetime).toEqual({
      completed: 3,
      elapsed: 23, // Sep 1..23
      rate: 3 / 23,
    })
  })

  it('reports a living chain as the current streak', () => {
    const { store, meditate } = seedStore()
    const stats = store.getStats(meditate.id)!
    expect(stats.currentStreak).toBe(23)
    expect(stats.bestStreak).toBe(23)
    expect(stats.lifetime.rate).toBe(1)
  })

  it('pools only active habits in the aggregate', () => {
    const { store, run } = seedStore()

    const before = store.getAggregateStats()
    expect(before.lifetime.completed).toBe(26) // 3 + 23
    expect(before.lifetime.elapsed).toBe(46) // 23 + 23
    expect(before.lifetime.rate).toBe(26 / 46)

    store.archiveHabit(run.id)
    const after = store.getAggregateStats()
    expect(after.lifetime.completed).toBe(23)
    expect(after.lifetime.elapsed).toBe(23)
    expect(after.lifetime.rate).toBe(1)
  })

  it('returns null stats for unknown ids', () => {
    const { store } = makeStore()
    expect(store.getStats('nope')).toBeNull()
  })
})

describe('reminders', () => {
  it('defaults to enabled and persists the global toggle', () => {
    const { store, storage } = makeStore()
    expect(store.isRemindersEnabled()).toBe(true)

    store.setRemindersEnabled(false)
    expect(store.isRemindersEnabled()).toBe(false)

    const reloaded = createHabitStore({ storage, now: () => NOW })
    expect(reloaded.isRemindersEnabled()).toBe(false)
  })

  it('keeps legacy payloads (no toggle field) enabled', () => {
    const storage = createMemoryStorage()
    storage.raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, habits: [] })
    const { store } = makeStore({ storage })
    expect(store.isRemindersEnabled()).toBe(true)
  })

  it('turning the toggle off does not delete per-habit times', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Meditate', reminderTime: '07:30' })

    store.setRemindersEnabled(false)

    expect(store.getState().habits[0].reminderTime).toBe('07:30')
    expect(habit.reminderTime).toBe('07:30')
  })

  it('notifies subscribers when the toggle changes', () => {
    const { store } = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setRemindersEnabled(false)
    expect(listener).toHaveBeenCalledTimes(1)

    store.setRemindersEnabled(false) // same value → no commit
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stores a valid reminder time on create and rejects malformed ones', () => {
    const { store } = makeStore()
    const habit = store.createHabit({
      name: 'Meditate',
      reminderTime: ' 07:30 ',
    })
    expect(habit.reminderTime).toBe('07:30')

    expect(() =>
      store.createHabit({ name: 'Bad', reminderTime: '9am' }),
    ).toThrow('HH:MM')
    expect(store.getState().habits).toHaveLength(1)
  })

  it('sets, keeps, and clears the reminder time through updateHabit', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Meditate' })

    store.updateHabit(habit.id, { name: 'Meditate', reminderTime: '21:00' })
    expect(store.getState().habits[0].reminderTime).toBe('21:00')

    // An update that doesn't mention the time (undefined) clears it,
    // matching description semantics; the row form passes it back instead.
    store.updateHabit(habit.id, { name: 'Meditate' })
    expect(store.getState().habits[0].reminderTime).toBeUndefined()
  })
})

describe('exportData / reset', () => {
  it('exports version, habits with completions, and settings', () => {
    const { store } = makeStore()
    store.createHabit({
      name: 'Meditate',
      description: 'Ten minutes',
      reminderTime: '07:30',
    })
    store.toggleCompletion(store.getState().habits[0].id)
    store.setRemindersEnabled(false)

    const payload = store.exportData()

    expect(payload.schemaVersion).toBe(SCHEMA_VERSION)
    expect(payload.remindersEnabled).toBe(false)
    expect(payload.habits).toHaveLength(1)
    expect(payload.habits[0].name).toBe('Meditate')
    expect(payload.habits[0].reminderTime).toBe('07:30')
    expect(payload.habits[0].completedDates).toEqual([TODAY])
    // Survives a JSON round-trip byte-for-byte (this is what gets downloaded).
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('stays in sync as the store changes', () => {
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Run' })

    store.toggleCompletion(habit.id)
    expect(store.exportData().habits[0].completedDates).toEqual([TODAY])

    store.deleteHabit(habit.id)
    expect(store.exportData().habits).toEqual([])
  })

  it('reset clears habits and settings, persisted, and notifies', () => {
    const { store, storage } = makeStore()
    store.createHabit({ name: 'Meditate', reminderTime: '07:30' })
    store.setRemindersEnabled(false)
    const listener = vi.fn()
    store.subscribe(listener)

    store.reset()

    expect(store.getState()).toEqual({ habits: [], remindersEnabled: true })
    expect(listener).toHaveBeenCalledTimes(1)

    const parsed = JSON.parse(storage.raw!)
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.habits).toEqual([])
    expect(parsed.remindersEnabled).toBe(true)

    // A fresh store over the same storage starts clean ("empty state").
    const reloaded = createHabitStore({ storage, now: () => NOW })
    expect(reloaded.getState().habits).toEqual([])
    expect(reloaded.isRemindersEnabled()).toBe(true)
  })

  it('reset on an already-empty store is safe', () => {
    const { store } = makeStore()
    expect(() => store.reset()).not.toThrow()
    expect(store.getState().habits).toEqual([])
  })
})
