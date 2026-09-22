import { useEffect, useState, useSyncExternalStore } from 'react'
import CalendarView from './components/CalendarView'
import HabitForm from './components/HabitForm'
import RemindersBar from './components/RemindersBar'
import StatsView from './components/StatsView'
import TodayList from './components/TodayList'
import { createBrowserNotificationSender } from './reminders/notifications'
import { createReminderScheduler } from './reminders/scheduler'
import { defaultStore } from './store/defaultStore'
import type { HabitStore } from './store/habitStore'

type View = 'today' | 'calendar' | 'stats'

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
  const [view, setView] = useState<View>('today')
  const [calendarHabitId, setCalendarHabitId] = useState<string | null>(null)
  const [yearMonth, setYearMonth] = useState(() => {
    const [year, month] = store.getToday().split('-').map(Number)
    return { year, month: month - 1 }
  })

  const allHabits = state.habits
  const activeHabits = allHabits.filter((habit) => !habit.archivedAt)
  const rows = activeHabits.map((habit) => {
    const info = store.getStreakInfo(habit.id)
    return {
      habit,
      streak: info?.streak ?? 0,
      status: info?.status ?? 'streak-lost',
    }
  })

  const selectedHabit =
    allHabits.find((habit) => habit.id === calendarHabitId) ??
    allHabits[0] ??
    null
  const month = selectedHabit
    ? store.getCalendar(selectedHabit.id, yearMonth.year, yearMonth.month)
    : null

  function shiftMonth(delta: number) {
    setYearMonth(({ year, month: m }) => {
      const next = m + delta
      if (next < 0) return { year: year - 1, month: 11 }
      if (next > 11) return { year: year + 1, month: 0 }
      return { year, month: next }
    })
  }

  // Drive the reminder scheduler while the tab is open. Exact-minute matching
  // inside the scheduler means a reminder missed with the tab closed is not
  // replayed on load.
  useEffect(() => {
    const scheduler = createReminderScheduler({
      getHabits: () => store.getState().habits,
      isRemindersEnabled: () => store.isRemindersEnabled(),
      now: () => new Date(),
      notify: createBrowserNotificationSender(),
    })
    scheduler.tick()
    const id = setInterval(() => scheduler.tick(), 15_000)
    return () => clearInterval(id)
  }, [store])

  return (
    <main>
      <h1>Habit Tracker</h1>

      <nav aria-label="Views">
        <button
          type="button"
          onClick={() => setView('today')}
          aria-current={view === 'today' ? 'page' : undefined}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          aria-current={view === 'calendar' ? 'page' : undefined}
        >
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setView('stats')}
          aria-current={view === 'stats' ? 'page' : undefined}
        >
          Stats
        </button>
      </nav>

      <RemindersBar
        enabled={state.remindersEnabled}
        onToggle={(enabled) => store.setRemindersEnabled(enabled)}
      />

      {view === 'stats' ? (
        <StatsView
          aggregate={store.getAggregateStats()}
          entries={allHabits.flatMap((habit) => {
            const stats = store.getStats(habit.id)
            return stats ? [{ habit, stats }] : []
          })}
        />
      ) : view === 'calendar' ? (
        selectedHabit && month ? (
          <CalendarView
            habit={selectedHabit}
            habits={allHabits}
            month={month}
            onSelectHabit={setCalendarHabitId}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onToggleDate={(date) =>
              selectedHabit && store.toggleCompletion(selectedHabit.id, date)
            }
          />
        ) : (
          <section aria-label="Calendar">
            <div className="empty-state">
              <p>No habits yet — create one in the Today view.</p>
            </div>
          </section>
        )
      ) : (
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
      )}
    </main>
  )
}
