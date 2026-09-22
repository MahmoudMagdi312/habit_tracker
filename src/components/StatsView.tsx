import type { CSSProperties } from 'react'
import { activityStrip } from '../domain/stats'
import type { AggregateStats, HabitStats } from '../domain/stats'
import type { Habit } from '../domain/types'

function percent(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

function dayLabel(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}

/**
 * A dt/dd pair. When `rate` is given the row doubles as a progress bar:
 * `--rate`/`--bar` custom properties on the div drive presentational
 * pseudo-element track + fill (no extra DOM node, nothing to announce).
 */
function Row({
  label,
  value,
  rate,
  color,
}: {
  label: string
  value: string
  rate?: number | null
  color?: string
}) {
  const barred = rate !== undefined
  const style = barred
    ? ({
        '--rate': `${Math.round((rate ?? 0) * 100)}%`,
        '--bar': color ?? 'var(--accent)',
      } as CSSProperties)
    : undefined

  return (
    <div className={barred ? 'stat-row barred' : 'stat-row'} style={style}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function StatsView({
  aggregate,
  entries,
  today,
}: {
  aggregate: AggregateStats
  entries: { habit: Habit; stats: HabitStats }[]
  today: string
}) {
  return (
    <section aria-label="Stats" className="stats-view">
      <article className="stat-card aggregate">
        <h2>Overall</h2>
        <dl>
          <Row label="Last 30 days" value={percent(aggregate.last30.rate)} rate={aggregate.last30.rate} />
          <Row label="Last 90 days" value={percent(aggregate.last90.rate)} rate={aggregate.last90.rate} />
          <Row label="Lifetime" value={percent(aggregate.lifetime.rate)} rate={aggregate.lifetime.rate} />
        </dl>
      </article>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No habits yet — create one in the Today view.</p>
        </div>
      ) : (
        entries.map(({ habit, stats }) => (
          <article key={habit.id} className="stat-card">
            <h3>
              <span aria-hidden="true">{habit.icon}</span> {habit.name}
              {habit.archivedAt && <span className="archived-tag">archived</span>}
            </h3>
            <div
              className="activity-strip"
              aria-hidden="true"
              style={{ '--habit-color': habit.color } as CSSProperties}
            >
              {activityStrip(habit, today).map((day) => (
                <span key={day.date} className={`strip-cell ${day.state}`} />
              ))}
            </div>
            <dl>
              <Row
                label="Current streak"
                value={`🔥 ${dayLabel(stats.currentStreak)}`}
              />
              <Row label="Best streak" value={dayLabel(stats.bestStreak)} />
              <Row
                label="Last 30 days"
                value={percent(stats.last30.rate)}
                rate={stats.last30.rate}
                color={habit.color}
              />
              <Row
                label="Last 90 days"
                value={percent(stats.last90.rate)}
                rate={stats.last90.rate}
                color={habit.color}
              />
              <Row
                label="Lifetime"
                value={percent(stats.lifetime.rate)}
                rate={stats.lifetime.rate}
                color={habit.color}
              />
            </dl>
          </article>
        ))
      )}
    </section>
  )
}
