export interface Habit {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  reminderTime?: string
  createdAt: string
  archivedAt?: string
  completedDates: string[]
}

export interface CreateHabitInput {
  name: string
  description?: string
  icon?: string
  color?: string
}

export interface HabitStoreState {
  habits: Habit[]
}

export interface PersistedState {
  schemaVersion: number
  habits: Habit[]
}
