import type { CSSProperties } from 'react'
import type { CalendarMonth } from '../domain/calendar'
import type { Habit } from '../domain/types'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarView({
  habit,
  habits,
  month,
  onSelectHabit,
  onPrevMonth,
  onNextMonth,
  onToggleDate,
}: {
  habit: Habit
  habits: Habit[]
  month: CalendarMonth
  onSelectHabit: (id: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToggleDate: (date: string) => void
}) {
  const monthName = MONTHS[month.monthIndex]

  return (
    <section aria-label="Calendar" className="calendar-view">
      <div className="calendar-controls">
        <button type="button" aria-label="Previous month" onClick={onPrevMonth}>
          ‹
        </button>
        <span className="month-title">
          {monthName} {month.year}
        </span>
        <button type="button" aria-label="Next month" onClick={onNextMonth}>
          ›
        </button>
      </div>

      <div className="field">
        <label htmlFor="calendar-habit">Habit</label>
        <select
          id="calendar-habit"
          aria-label="Select habit"
          value={habit.id}
          onChange={(event) => onSelectHabit(event.target.value)}
        >
          {habits.map((option) => (
            <option key={option.id} value={option.id}>
              {option.icon} {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="weekday-row" aria-hidden="true">
        {WEEKDAYS.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      <ul
        aria-label={`${monthName} ${month.year}`}
        className="calendar-grid"
        style={{ '--habit-color': habit.color } as CSSProperties}
      >
        {month.cells.map((cell, index) =>
          cell === null ? (
            <li key={`pad-${index}`} className="cell pad" aria-hidden="true" />
          ) : (
            <li key={cell.date} className={`cell ${cell.state}`}>
              <button
                type="button"
                disabled={!cell.toggleable}
                aria-label={`${monthName} ${cell.day}`}
                aria-pressed={cell.state === 'completed'}
                onClick={() => onToggleDate(cell.date)}
              >
                {cell.day}
              </button>
            </li>
          ),
        )}
      </ul>

      <div className="calendar-legend" aria-hidden="true">
        <span className="key completed">Completed</span>
        <span className="key missed">Missed</span>
        <span className="key today">Today</span>
        <span className="key future">Upcoming</span>
      </div>
    </section>
  )
}
