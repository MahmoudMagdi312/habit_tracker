import { describe, it, expect } from 'vitest'
import {
  aggregateStats,
  bestStreak,
  completionWindow,
  habitStats,
} from './stats'
import type { Habit } from './types'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Run',
    icon: '🏃',
    color: '#3b82f6',
    createdAt: '2026-09-01',
    completedDates: [],
    ...overrides,
  }
}

describe('bestStreak', () => {
  it('is 0 with no completions', () => {
    expect(bestStreak([])).toBe(0)
  })

  it('counts a consecutive run', () => {
    expect(
      bestStreak(['2026-09-01', '2026-09-02', '2026-09-03']),
    ).toBe(3)
  })

  it('keeps the longest run across a gap', () => {
    expect(
      bestStreak([
        '2026-09-01',
        '2026-09-02',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
        '2026-09-09',
      ]),
    ).toBe(3) // 4–6 beats 1–2
  })

  it('is order-independent and ignores duplicates', () => {
    expect(
      bestStreak(['2026-09-05', '2026-09-03', '2026-09-04', '2026-09-04']),
    ).toBe(3)
  })

  it('runs across a month boundary', () => {
    expect(bestStreak(['2026-08-31', '2026-09-01', '2026-09-02'])).toBe(3)
  })
})

describe('completionWindow', () => {
  it('measures a full window', () => {
    const stats = completionWindow(
      ['2026-09-21', '2026-09-22', '2026-09-23'],
      '2026-08-25',
      '2026-09-23',
      '2026-09-01',
    )
    expect(stats).toEqual({ completed: 3, elapsed: 23, rate: 3 / 23 })
  })

  it('floors the window at the creation date', () => {
    const stats = completionWindow(
      ['2026-09-22'],
      '2026-08-25',
      '2026-09-23',
      '2026-09-20',
    )
    // elapsed: Sep 20..23 = 4 days, not 30
    expect(stats).toEqual({ completed: 1, elapsed: 4, rate: 1 / 4 })
  })

  it('excludes completions after today', () => {
    const stats = completionWindow(
      ['2026-09-23', '2026-09-24'],
      '2026-09-23',
      '2026-09-23',
      '2026-09-01',
    )
    expect(stats.completed).toBe(1)
  })

  it('is null when the window contains no elapsed days', () => {
    const stats = completionWindow([], '2026-09-24', '2026-09-23', '2026-09-24')
    expect(stats).toEqual({ completed: 0, elapsed: 0, rate: null })
  })
})

describe('habitStats', () => {
  it('combines current streak, best streak, and the three windows', () => {
    const stats = habitStats(
      habit({ completedDates: ['2026-09-21', '2026-09-22'] }),
      '2026-09-23',
    )
    expect(stats.currentStreak).toBe(2) // alive through yesterday
    expect(stats.bestStreak).toBe(2)
    expect(stats.last30.elapsed).toBe(23) // Sep 1..23
    expect(stats.last90.completed).toBe(2)
    expect(stats.lifetime).toEqual({ completed: 2, elapsed: 23, rate: 2 / 23 })
  })
})

describe('aggregateStats', () => {
  it('pools numerators and denominators across habits', () => {
    const today = '2026-09-23'
    const a = habit({
      id: 'a',
      completedDates: ['2026-09-01', '2026-09-02', '2026-09-03'],
    })
    const b = habit({
      id: 'b',
      completedDates: ['2026-09-01', '2026-09-02'],
    })
    const stats = aggregateStats([a, b], today)
    expect(stats.lifetime.completed).toBe(5)
    expect(stats.lifetime.elapsed).toBe(46) // 23 + 23
    expect(stats.lifetime.rate).toBe(5 / 46)
  })

  it('is null with no habits', () => {
    const stats = aggregateStats([], '2026-09-23')
    expect(stats.lifetime).toEqual({ completed: 0, elapsed: 0, rate: null })
  })
})
