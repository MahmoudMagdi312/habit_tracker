import { describe, it, expect } from 'vitest'
import { buildCalendar } from './calendar'
import type { Habit } from './types'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Run',
    icon: '🏃',
    color: '#3b82f6',
    createdAt: '2026-09-21',
    completedDates: [],
    ...overrides,
  }
}

function cellsOf(year: number, monthIndex: number, h: Habit, today: string) {
  const month = buildCalendar(h, today, year, monthIndex)
  const map = new Map(
    month.cells
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => [c.day, c]),
  )
  return { month, map }
}

describe('buildCalendar', () => {
  it('pads leading weekdays (Sep 2026 starts on a Tuesday)', () => {
    const { month, map } = cellsOf(2026, 8, habit(), '2026-09-23')
    expect(month.cells[0]).toBeNull()
    expect(month.cells[1]).toBeNull()
    expect(month.cells[2]?.day).toBe(1)
    expect(map.get(30)?.date).toBe('2026-09-30')
  })

  it('has 28 days in February 2026', () => {
    const { month, map } = cellsOf(
      2026,
      1,
      habit({ createdAt: '2026-01-01' }),
      '2026-09-23',
    )
    const real = month.cells.filter((c) => c !== null)
    expect(real).toHaveLength(28)
    expect(map.get(28)?.date).toBe('2026-02-28')
  })

  it('classifies each day relative to creation, completion, and today', () => {
    const h = habit({ completedDates: ['2026-09-21'] })
    const { map } = cellsOf(2026, 8, h, '2026-09-23')

    expect(map.get(5)?.state).toBe('blocked')
    expect(map.get(21)?.state).toBe('completed')
    expect(map.get(22)?.state).toBe('missed')
    expect(map.get(23)?.state).toBe('today')
    expect(map.get(26)?.state).toBe('future')
  })

  it('marks only on/after creation and up to today as toggleable', () => {
    const h = habit({ completedDates: ['2026-09-21'] })
    const { map } = cellsOf(2026, 8, h, '2026-09-23')

    expect(map.get(20)?.toggleable).toBe(false) // before creation
    expect(map.get(21)?.toggleable).toBe(true) // completed, can uncheck
    expect(map.get(22)?.toggleable).toBe(true) // missed, can check
    expect(map.get(23)?.toggleable).toBe(true) // today
    expect(map.get(24)?.toggleable).toBe(false) // future
  })

  it('shows a future-only month for a habit created after it', () => {
    const h = habit({ createdAt: '2026-09-23' })
    const { month } = cellsOf(2026, 9, h, '2026-09-23') // October
    for (const cell of month.cells) {
      if (cell) expect(cell.state).toBe('future')
    }
  })
})
