import type { Habit, PersistedState } from '../domain/types'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'habit-tracker'

export interface StorageAdapter {
  read(): string | null
  write(value: string): void
}

export function createLocalStorageAdapter(
  key: string = STORAGE_KEY,
): StorageAdapter {
  return {
    read: () => window.localStorage.getItem(key),
    write: (value) => window.localStorage.setItem(key, value),
  }
}

export function emptyState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, habits: [], remindersEnabled: true }
}

/**
 * Migrations from a given schema version to the next.
 * Keyed by the version being migrated FROM, e.g.:
 *   1: (data) => ({ ...data, schemaVersion: 2, /* transform * / })
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>
const migrations: Record<number, Migration> = {}

function sanitizeHabit(raw: unknown): Habit | null {
  if (typeof raw !== 'object' || raw === null) return null
  const h = raw as Record<string, unknown>
  if (
    typeof h.id !== 'string' ||
    typeof h.name !== 'string' ||
    typeof h.createdAt !== 'string'
  ) {
    return null
  }
  return {
    id: h.id,
    name: h.name,
    ...(typeof h.description === 'string' ? { description: h.description } : {}),
    icon: typeof h.icon === 'string' ? h.icon : '🎯',
    color: typeof h.color === 'string' ? h.color : '#3b82f6',
    ...(typeof h.reminderTime === 'string'
      ? { reminderTime: h.reminderTime }
      : {}),
    createdAt: h.createdAt,
    ...(typeof h.archivedAt === 'string' ? { archivedAt: h.archivedAt } : {}),
    completedDates: Array.isArray(h.completedDates)
      ? h.completedDates.filter((d): d is string => typeof d === 'string')
      : [],
  }
}

/**
 * Loads persisted state, migrating through any intermediate schema versions.
 * Missing, corrupt, or unrecognizable data yields a safe empty state
 * rather than throwing — user data loss only ever happens via explicit reset.
 */
export function loadState(storage: StorageAdapter): PersistedState {
  const raw = storage.read()
  if (raw == null) return emptyState()

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return emptyState()
  }
  if (typeof data !== 'object' || data === null) return emptyState()

  let record = data as Record<string, unknown>
  const version = record.schemaVersion
  if (typeof version !== 'number' || version < 1 || version > SCHEMA_VERSION) {
    return emptyState()
  }

  let current = version
  while (current < SCHEMA_VERSION) {
    const migrate = migrations[current]
    if (!migrate) return emptyState()
    record = migrate(record)
    current = typeof record.schemaVersion === 'number' ? record.schemaVersion : current + 1
  }

  const habits = Array.isArray(record.habits)
    ? record.habits.map(sanitizeHabit).filter((h): h is Habit => h !== null)
    : []
  return {
    schemaVersion: SCHEMA_VERSION,
    habits,
    remindersEnabled: record.remindersEnabled !== false,
  }
}

export function saveState(
  storage: StorageAdapter,
  state: Omit<PersistedState, 'schemaVersion'>,
): void {
  storage.write(JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
}
