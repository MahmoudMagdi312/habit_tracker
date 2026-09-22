import { createHabitStore } from './habitStore'

/** App-wide store backed by localStorage. Tests inject their own store instead. */
export const defaultStore = createHabitStore()
