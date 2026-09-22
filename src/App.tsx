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

  const activeHabits = state.habits.filter((habit) => !habit.archivedAt)
  const rows = activeHabits.map((habit) => {
    const info = store.getStreakInfo(habit.id)
    return {
      habit,
      streak: info?.streak ?? 0,
      status: info?.status ?? 'streak-lost',
    }
  })

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
              rows={rows}
              onToggle={(id) => store.toggleCompletion(id)}
              onEdit={(id, input) => store.updateHabit(id, input)}
              onArchive={(id) => store.archiveHabit(id)}
              onDelete={(id) => store.deleteHabit(id)}
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
            onSubmit={(input) => {
              store.createHabit(input)
              setShowForm(false)
            }}
          />
        )}
      </section>
    </main>
  )
}
