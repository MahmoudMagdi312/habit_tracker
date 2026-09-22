import type { CSSProperties } from 'react'
import type { Habit } from '../domain/types'

export default function TodayList({
  habits,
  today,
  onToggle,
}: {
  habits: Habit[]
  today: string
  onToggle: (id: string) => void
}) {
  return (
    <ul aria-label="Today's habits" className="habit-list">
      {habits.map((habit) => {
        const done = habit.completedDates.includes(today)
        return (
          <li
            key={habit.id}
            className={done ? 'habit done' : 'habit'}
            style={{ '--habit-color': habit.color } as CSSProperties}
          >
            <label>
              <input
                type="checkbox"
                checked={done}
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
          </li>
        )
      })}
    </ul>
  )
}
