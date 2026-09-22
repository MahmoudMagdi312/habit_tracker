import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createHabitStore } from './store/habitStore'
import type { StorageAdapter } from './storage/storage'

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

const NOW = new Date(2026, 8, 23, 10, 30)

function makeStore() {
  const storage = createMemoryStorage()
  return { storage, store: createHabitStore({ storage, now: () => NOW }) }
}

describe('App', () => {
  it('renders the app heading', () => {
    const { store } = makeStore()
    render(<App store={store} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Habit Tracker' }),
    ).toBeInTheDocument()
  })

  it('shows an empty state with a create call to action when there are no habits', () => {
    const { store } = makeStore()
    render(<App store={store} />)
    expect(screen.getByText('No habits yet.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create your first habit' }),
    ).toBeInTheDocument()
  })

  it('creates a habit from the empty state and shows it in the list', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Create your first habit' }))
    await user.type(screen.getByLabelText('Name'), 'Drink water')
    await user.type(screen.getByLabelText('Description (optional)'), 'One glass')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(screen.getByText('Drink water')).toBeInTheDocument()
    expect(screen.getByText('One glass')).toBeInTheDocument()
    expect(screen.queryByText('No habits yet.')).not.toBeInTheDocument()
  })

  it('checks off a habit and unchecks it on a second click', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Create your first habit' }))
    await user.type(screen.getByLabelText('Name'), 'Stretch')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    const checkbox = screen.getByRole('checkbox', { name: /Stretch/ })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('keeps habits and check-offs across a reload (fresh store, same storage)', async () => {
    const user = userEvent.setup()
    const { storage } = makeStore()

    const first = render(<App store={createHabitStore({ storage, now: () => NOW })} />)
    await user.click(screen.getByRole('button', { name: 'Create your first habit' }))
    await user.type(screen.getByLabelText('Name'), 'Meditate')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))
    await user.click(screen.getByRole('checkbox', { name: /Meditate/ }))
    first.unmount()

    // Simulate reload: brand-new store and App over the same storage.
    render(<App store={createHabitStore({ storage, now: () => NOW })} />)
    expect(screen.getByText('Meditate')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Meditate/ })).toBeChecked()
  })

  it('shows the streak count and marks yesterday-completed habits as at risk', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    let clock = new Date(2026, 8, 22, 21, 0) // Sep 22, 9pm
    const store = createHabitStore({ storage, now: () => clock })

    const habit = store.createHabit({ name: 'Run' })
    store.toggleCompletion(habit.id) // completed Sep 22

    clock = new Date(2026, 8, 23, 9, 0) // next day
    render(<App store={store} />)

    expect(screen.getByText('🔥 1 day')).toBeInTheDocument()
    expect(screen.getByText('at risk')).toBeInTheDocument()

    // Checking off today extends the chain and clears the warning.
    await user.click(screen.getByRole('checkbox', { name: /Run/ }))
    expect(screen.getByText('🔥 2 days')).toBeInTheDocument()
    expect(screen.queryByText('at risk')).not.toBeInTheDocument()
  })

  it('shows "starts today" and 0 days for a brand-new habit', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const store = createHabitStore({
      storage,
      now: () => new Date(2026, 8, 23, 9, 0),
    })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Create your first habit' }))
    await user.type(screen.getByLabelText('Name'), 'Journal')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(screen.getByText('🔥 0 days')).toBeInTheDocument()
    expect(screen.getByText('starts today')).toBeInTheDocument()
    expect(screen.queryByText('streak lost')).not.toBeInTheDocument()
  })

  it('edits a habit through the row edit form', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Yoga' })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Edit Yoga' }))
    const nameInput = screen.getByLabelText('Name')
    expect(nameInput).toHaveValue('Yoga')

    await user.clear(nameInput)
    await user.type(nameInput, 'Power yoga')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByText('Power yoga')).toBeInTheDocument()
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
    expect(store.getState().habits[0].name).toBe('Power yoga')
  })

  it('cancels editing without changing the habit', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Yoga' })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Edit Yoga' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Something else')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(store.getState().habits[0].name).toBe('Yoga')
  })

  it('archives a habit after confirmation, keeping its history', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    const habit = store.createHabit({ name: 'Yoga' })
    store.toggleCompletion(habit.id)
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Archive Yoga' }))
    expect(screen.getByText(/Archive .*Yoga/)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Confirm archive Yoga' }),
    )

    // Gone from Today…
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: /Yoga/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create your first habit' }),
    ).toBeInTheDocument()
    // …but history and the habit itself survive in the store.
    expect(store.getState().habits[0].archivedAt).toBe('2026-09-23')
    expect(store.getState().habits[0].completedDates).toEqual(['2026-09-23'])
  })

  it('cancels an archive confirmation without archiving', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Yoga' })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Archive Yoga' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(store.getState().habits[0].archivedAt).toBeUndefined()
    expect(
      screen.getByRole('button', { name: 'Archive Yoga' }),
    ).toBeInTheDocument()
  })

  it('deletes a habit after confirmation', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Yoga' })
    store.createHabit({ name: 'Run' })
    render(<App store={store} />)

    // Cancel first: the confirm flow is dismissable.
    await user.click(screen.getByRole('button', { name: 'Delete Yoga' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Yoga')).toBeInTheDocument()

    // Now really delete.
    await user.click(screen.getByRole('button', { name: 'Delete Yoga' }))
    await user.click(
      screen.getByRole('button', { name: 'Confirm delete Yoga' }),
    )

    expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(store.getState().habits.map((h) => h.name)).toEqual(['Run'])
  })

  it('reaches the calendar from the nav and shows the month grid', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Run' })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(screen.getByText('September 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'September 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'September 30' })).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Select habit' }),
    ).toBeInTheDocument()
    // Today view is hidden while the calendar is open
    expect(screen.queryByText('Add habit')).not.toBeInTheDocument()
  })

  it('visually distinguishes completed, missed, blocked, and future days', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    let clock = new Date(2026, 8, 21, 9, 0)
    const store = createHabitStore({ storage, now: () => clock })
    const habit = store.createHabit({ name: 'Run' })
    store.toggleCompletion(habit.id) // created + done Sep 21

    clock = new Date(2026, 8, 23, 9, 0)
    render(<App store={store} />)
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    const sep5 = screen.getByRole('button', { name: 'September 5' })
    expect(sep5).toBeDisabled()
    expect(sep5.closest('.cell')).toHaveClass('blocked')

    const sep21 = screen.getByRole('button', { name: 'September 21' })
    expect(sep21).toHaveAttribute('aria-pressed', 'true')
    expect(sep21.closest('.cell')).toHaveClass('completed')

    const sep22 = screen.getByRole('button', { name: 'September 22' })
    expect(sep22).toHaveAttribute('aria-pressed', 'false')
    expect(sep22).toBeEnabled()
    expect(sep22.closest('.cell')).toHaveClass('missed')

    expect(
      screen.getByRole('button', { name: 'September 23' }).closest('.cell'),
    ).toHaveClass('today')

    const sep26 = screen.getByRole('button', { name: 'September 26' })
    expect(sep26).toBeDisabled()
    expect(sep26.closest('.cell')).toHaveClass('future')
  })

  it('fixes a forgotten past day from the calendar and updates the streak', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    let clock = new Date(2026, 8, 21, 9, 0)
    const store = createHabitStore({ storage, now: () => clock })
    const habit = store.createHabit({ name: 'Run' })
    store.toggleCompletion(habit.id) // done Sep 21, forgot Sep 22

    clock = new Date(2026, 8, 23, 9, 0)
    render(<App store={store} />)
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    const sep22 = screen.getByRole('button', { name: 'September 22' })
    await user.click(sep22)
    expect(
      screen.getByRole('button', { name: 'September 22' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(store.getState().habits[0].completedDates).toEqual([
      '2026-09-21',
      '2026-09-22',
    ])

    // Back on Today: the streak now counts 21+22, alive through yesterday.
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('🔥 2 days')).toBeInTheDocument()
    expect(screen.getByText('at risk')).toBeInTheDocument()
  })

  it('navigates between months', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Run' })
    render(<App store={store} />)
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'October 1' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('August 2026')).toBeInTheDocument()
  })

  it('keeps archived habits selectable in the calendar', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    const yoga = store.createHabit({ name: 'Yoga' })
    store.createHabit({ name: 'Run' })
    store.archiveHabit(yoga.id)
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Select habit' }),
      yoga.id,
    )
    expect(
      screen.getByRole('combobox', { name: 'Select habit' }),
    ).toHaveValue(yoga.id)
  })

  it('shows per-habit and aggregate stats in the Stats view', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    let clock = new Date(2026, 8, 1, 12, 0)
    const store = createHabitStore({ storage, now: () => clock })
    const run = store.createHabit({ name: 'Run', icon: '🏃' })
    const meditate = store.createHabit({ name: 'Meditate', icon: '🧘' })

    // Both complete Sep 1–3; only Meditate continues Sep 4–23.
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

    render(<App store={store} />)
    await user.click(screen.getByRole('button', { name: 'Stats' }))

    const region = screen.getByRole('region', { name: 'Stats' })
    expect(region).toBeInTheDocument()

    // Run: chain broke after Sep 3 → current 0, best 3, 3/23 = 13% everywhere.
    const runCard = screen
      .getByText('Run')
      .closest('.stat-card')! as HTMLElement
    expect(within(runCard).getByText('🔥 0 days')).toBeInTheDocument()
    expect(within(runCard).getByText('3 days')).toBeInTheDocument()
    expect(within(runCard).getAllByText('13%')).toHaveLength(3)

    // Meditate: 23-day living chain, 100% in every window.
    const meditateCard = screen
      .getByText('Meditate')
      .closest('.stat-card')! as HTMLElement
    expect(within(meditateCard).getByText('🔥 23 days')).toBeInTheDocument()
    expect(within(meditateCard).getByText('23 days')).toBeInTheDocument()
    expect(within(meditateCard).getAllByText('100%')).toHaveLength(3)

    // Aggregate across active habits: (3 + 23) / (23 + 23) = 57%.
    const overallCard = screen
      .getByText('Overall')
      .closest('.stat-card')! as HTMLElement
    expect(within(overallCard).getAllByText('57%')).toHaveLength(3)
  })

  it('navigates between all three views', async () => {
    const user = userEvent.setup()
    const { store } = makeStore()
    store.createHabit({ name: 'Run' })
    render(<App store={store} />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(screen.getByRole('region', { name: 'Stats' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    expect(
      screen.getByRole('region', { name: 'Calendar' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
  })
})
