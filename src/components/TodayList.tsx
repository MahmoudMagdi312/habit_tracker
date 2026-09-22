import { useState } from 'react'
import type { CSSProperties } from 'react'
import HabitForm from './HabitForm'
import type { CreateHabitInput, Habit } from '../domain/types'
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

function HabitRow({
  habit,
  streak,
  status,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: Habit
  streak: number
  status: StreakStatus
  onToggle: () => void
  onEdit: (input: CreateHabitInput) => void
  onArchive: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(
    null,
  )

  const style = { '--habit-color': habit.color } as CSSProperties

  if (editing) {
    return (
      <li className={`habit ${status} editing`} style={style}>
        <HabitForm
          ariaLabel="Edit habit"
          submitLabel="Save changes"
          initialValues={{
            name: habit.name,
            description: habit.description,
            icon: habit.icon,
            color: habit.color,
            reminderTime: habit.reminderTime,
          }}
          onSubmit={(input) => {
            onEdit(input)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li
      className={`habit ${status}${confirming ? ' confirming' : ''}`}
      style={style}
    >
      <label>
        <input type="checkbox" checked={status === 'done'} onChange={onToggle} />
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

      <div className="row-actions">
        {confirming === 'archive' ? (
          <>
            <span className="confirm-text">
              Archive “{habit.name}”?
            </span>
            <button
              type="button"
              aria-label={`Confirm archive ${habit.name}`}
              onClick={onArchive}
            >
              Archive
            </button>
            <button type="button" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        ) : confirming === 'delete' ? (
          <>
            <span className="confirm-text">Delete “{habit.name}”?</span>
            <button
              type="button"
              aria-label={`Confirm delete ${habit.name}`}
              onClick={onDelete}
            >
              Delete
            </button>
            <button type="button" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Edit ${habit.name}`}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Archive ${habit.name}`}
              onClick={() => setConfirming('archive')}
            >
              Archive
            </button>
            <button
              type="button"
              aria-label={`Delete ${habit.name}`}
              onClick={() => setConfirming('delete')}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export default function TodayList({
  rows,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: {
  rows: TodayRow[]
  onToggle: (id: string) => void
  onEdit: (id: string, input: CreateHabitInput) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <ul aria-label="Today's habits" className="habit-list">
      {rows.map(({ habit, streak, status }) => (
        <HabitRow
          key={habit.id}
          habit={habit}
          streak={streak}
          status={status}
          onToggle={() => onToggle(habit.id)}
          onEdit={(input) => onEdit(habit.id, input)}
          onArchive={() => onArchive(habit.id)}
          onDelete={() => onDelete(habit.id)}
        />
      ))}
    </ul>
  )
}
