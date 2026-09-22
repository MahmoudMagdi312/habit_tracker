import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
