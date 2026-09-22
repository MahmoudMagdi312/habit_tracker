import { describe, it, expect } from 'vitest'
import { currentStreak, previousDateKey, streakStatus } from './streaks'
import type { Habit } from './types'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Test',
    icon: '🎯',
    color: '#3b82f6',
    createdAt: '2026-09-01',
    completedDates: [],
    ...overrides,
  }
}

describe('previousDateKey', () => {
  it('steps back across month, year, and leap boundaries', () => {
    expect(previousDateKey('2026-09-01')).toBe('2026-08-31')
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31')
    expect(previousDateKey('2028-03-01')).toBe('2028-02-29')
    expect(previousDateKey('2026-06-15')).toBe('2026-06-14')
  })
})

describe('currentStreak', () => {
  it('is 0 with no completions', () => {
    expect(currentStreak([], '2026-09-23')).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(
      currentStreak(
        ['2026-09-21', '2026-09-22', '2026-09-23'],
        '2026-09-23',
      ),
    ).toBe(3)
  })

  it('counts through yesterday when today is still pending', () => {
    expect(
      currentStreak(['2026-09-21', '2026-09-22'], '2026-09-23'),
    ).toBe(2)
  })

  it('breaks to 0 when yesterday was missed too', () => {
    expect(
      currentStreak(['2026-09-20', '2026-09-21'], '2026-09-23'),
    ).toBe(0)
  })

  it('restarts at 1 after a gap', () => {
    expect(currentStreak(['2026-09-23'], '2026-09-23')).toBe(1)
  })

  it('runs across a month boundary', () => {
    expect(
      currentStreak(
        ['2026-08-30', '2026-08-31', '2026-09-01'],
        '2026-09-01',
      ),
    ).toBe(3)
  })

  it('ignores completions after today', () => {
    expect(
      currentStreak(['2026-09-23', '2026-09-24'], '2026-09-23'),
    ).toBe(1)
  })
})

describe('streakStatus', () => {
  it('is done when completed today', () => {
    const h = habit({ completedDates: ['2026-09-23'] })
    expect(streakStatus(h, '2026-09-23')).toBe('done')
  })

  it('is starts-today when created today and not yet completed', () => {
    const h = habit({ createdAt: '2026-09-23' })
    expect(streakStatus(h, '2026-09-23')).toBe('starts-today')
  })

  it('is at-risk when alive through yesterday but not done today', () => {
    const h = habit({ completedDates: ['2026-09-21', '2026-09-22'] })
    expect(streakStatus(h, '2026-09-23')).toBe('at-risk')
  })

  it('is streak-lost when the chain already broke', () => {
    const h = habit({ completedDates: ['2026-09-20'] })
    expect(streakStatus(h, '2026-09-23')).toBe('streak-lost')
  })

  it('is streak-lost for an old habit that never started', () => {
    const h = habit({ createdAt: '2026-09-01' })
    expect(streakStatus(h, '2026-09-23')).toBe('streak-lost')
  })
})
