import { describe, it, expect } from 'vitest'
import { createReminderScheduler } from './scheduler'
import type { NotificationSender, ReminderSchedulerDeps } from './scheduler'
import type { Habit } from '../domain/types'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Meditate',
    description: 'Ten quiet minutes',
    icon: '🧘',
    color: '#3b82f6',
    createdAt: '2026-09-01',
    completedDates: [],
    ...overrides,
  }
}

function at(hour: number, minute: number, second = 0): Date {
  return new Date(2026, 8, 23, hour, minute, second)
}

function setup(
  habits: Habit[],
  now: () => Date,
  remindersEnabled = true,
): { deps: ReminderSchedulerDeps; sent: Array<{ title: string; body?: string }> } {
  const sent: Array<{ title: string; body?: string }> = []
  const notify: NotificationSender = {
    send(title, options) {
      sent.push({ title, body: options?.body })
    },
  }
  const deps: ReminderSchedulerDeps = {
    getHabits: () => habits,
    isRemindersEnabled: () => remindersEnabled,
    now,
    notify,
  }
  return { deps, sent }
}

describe('createReminderScheduler', () => {
  it('fires a notification with the habit name at the scheduled minute', () => {
    let clock = at(9, 0, 15)
    const { deps, sent } = setup([habit({ reminderTime: '09:00' })], () => clock)

    createReminderScheduler(deps).tick()

    expect(sent).toHaveLength(1)
    expect(sent[0].title).toContain('Meditate')
    expect(sent[0].body).toBe('Ten quiet minutes')
  })

  it('does not fire before the scheduled minute', () => {
    let clock = at(8, 59, 59)
    const { deps, sent } = setup([habit({ reminderTime: '09:00' })], () => clock)

    createReminderScheduler(deps).tick()
    expect(sent).toHaveLength(0)
  })

  it('does not double-fire within the same minute', () => {
    let clock = at(9, 0, 5)
    const { deps, sent } = setup([habit({ reminderTime: '09:00' })], () => clock)
    const scheduler = createReminderScheduler(deps)

    scheduler.tick()
    clock = at(9, 0, 45)
    scheduler.tick()

    expect(sent).toHaveLength(1)
  })

  it('never replays a minute that was missed while the tab was closed', () => {
    // Tab opens at 09:01 for an 09:00 reminder — first tick is already late.
    let clock = at(9, 1, 0)
    const { deps, sent } = setup([habit({ reminderTime: '09:00' })], () => clock)

    createReminderScheduler(deps).tick()

    expect(sent).toHaveLength(0)
  })

  it('fires again the next day after a date rollover', () => {
    let clock = at(9, 0, 5)
    const { deps, sent } = setup([habit({ reminderTime: '09:00' })], () => clock)
    const scheduler = createReminderScheduler(deps)

    scheduler.tick()
    clock = new Date(2026, 8, 24, 9, 0, 5)
    scheduler.tick()

    expect(sent).toHaveLength(2)
  })

  it('fires nothing while the global toggle is off', () => {
    let clock = at(9, 0, 15)
    const { deps, sent } = setup(
      [habit({ reminderTime: '09:00' })],
      () => clock,
      false,
    )

    createReminderScheduler(deps).tick()

    expect(sent).toHaveLength(0)
    // The habit itself is untouched — the scheduler never mutates.
    expect(deps.getHabits()[0].reminderTime).toBe('09:00')
  })

  it('skips archived habits and habits without a reminder time', () => {
    let clock = at(9, 0, 15)
    const { deps, sent } = setup(
      [
        habit({ id: 'a', archivedAt: '2026-09-10', reminderTime: '09:00' }),
        habit({ id: 'b', name: 'No reminder' }),
        habit({ id: 'c', name: 'Other time', reminderTime: '17:00' }),
      ],
      () => clock,
    )

    createReminderScheduler(deps).tick()

    expect(sent).toHaveLength(0)
  })

  it('fires one notification per matching habit', () => {
    let clock = at(9, 0, 15)
    const { deps, sent } = setup(
      [
        habit({ id: 'a', name: 'Meditate', reminderTime: '09:00' }),
        habit({ id: 'b', name: 'Stretch', reminderTime: '09:00' }),
      ],
      () => clock,
    )

    createReminderScheduler(deps).tick()

    expect(sent.map((s) => s.title).join('\n')).toContain('Meditate')
    expect(sent).toHaveLength(2)
  })
})
