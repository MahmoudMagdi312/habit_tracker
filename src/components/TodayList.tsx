import type { CSSProperties } from 'react'
import type { Habit } from '../domain/types'
import type { StreakStatus } from '../domain/streaks'

export interface TodayRow {
  habit: Habit
  streak: number
  status: StreakStatus
}

const STATUS_LABEL: Record<Exclude<StreakStatus, 'done'>, string> = {
  'at-risk': 'at risk',
  'starts-today': 'starts today',
  'streak-lost': 'streak lost',
}

export default function TodayList({
  rows,
  onToggle,
}: {
  rows: TodayRow[]
  onToggle: (id: string) => void
}) {
  return (
    <ul aria-label="Today's habits" className="habit-list">
      {rows.map(({ habit, streak, status }) => (
        <li
          key={habit.id}
          className={`habit ${status}`}
          style={{ '--habit-color': habit.color } as CSSProperties}
        >
          <label>
            <input
              type="checkbox"
              checked={status === 'done'}
              onChange={() => onToggle(habit.id)}
            />
            <span className="habit-icon" aria-hidden="true">
              {habit.icon}
            </span>
            <span className="habit-text">
              <span className="habit-name">{habit.name}</span>
              {habit.description && (
                <span className="habit-description">{habit.description}</span>
              )}
            </span>
          </label>
          <span className="streak-badge">
            <span className="streak">
              🔥 {streak} {streak === 1 ? 'day' : 'days'}
            </span>
            {status !== 'done' && (
              <span className={`streak-status ${status}`}>
                {STATUS_LABEL[status]}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
