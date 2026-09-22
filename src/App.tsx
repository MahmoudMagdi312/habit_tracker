import { useState, useSyncExternalStore } from 'react'
import HabitForm from './components/HabitForm'
import TodayList from './components/TodayList'
import { defaultStore } from './store/defaultStore'
import type { HabitStore } from './store/habitStore'

export default function App({
  store = defaultStore,
}: {
  store?: HabitStore
} = {}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  )
  const [showForm, setShowForm] = useState(false)

  const today = store.getToday()
  const activeHabits = state.habits.filter((habit) => !habit.archivedAt)

  return (
    <main>
      <h1>Habit Tracker</h1>

      <section aria-label="Today">
        {activeHabits.length === 0 && !showForm ? (
          <div className="empty-state">
            <p>No habits yet.</p>
            <button type="button" onClick={() => setShowForm(true)}>
              Create your first habit
            </button>
          </div>
        ) : (
          <>
            <TodayList
              habits={activeHabits}
              today={today}
              onToggle={(id) => store.toggleCompletion(id)}
            />
            {!showForm && (
              <button type="button" onClick={() => setShowForm(true)}>
                Add habit
              </button>
            )}
          </>
        )}

        {showForm && (
          <HabitForm
            onCreate={(input) => {
              store.createHabit(input)
              setShowForm(false)
            }}
          />
        )}
      </section>
    </main>
  )
}
