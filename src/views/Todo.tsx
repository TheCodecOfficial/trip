import { useState } from 'preact/hooks'
import type { Todo as TodoT } from '../schema.ts'
import type { TripData } from '../store.ts'
import { addTodo, removeTodo, setTodoDone } from '../store.ts'
import { dateRange, formatDay, todayJst } from '../dates.ts'

export function TodoList({ todos }: { todos: TodoT[] }) {
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done))
  return (
    <ul class="todos">
      {sorted.map((t) => (
        <li key={t.id} class={t.done ? 'done' : ''}>
          <label>
            <input type="checkbox" checked={t.done} onChange={(e) => setTodoDone(t.id, (e.target as HTMLInputElement).checked)} />
            <span>{t.text}</span>
          </label>
          {t.id.startsWith('local-') && (
            <button
              type="button"
              class="icon-btn small"
              aria-label="Delete"
              onClick={() => confirm('Delete this to-do?') && removeTodo(t.id)}
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function Todo({ trip }: { trip: TripData }) {
  const [hideDone, setHideDone] = useState(false)
  const days = dateRange(trip.trip.start, trip.trip.end)
  const today = todayJst()
  const visible = trip.todos.filter((t) => !(hideDone && t.done))
  const groups: [string, TodoT[]][] = [
    ['Before the trip / anytime', visible.filter((t) => !t.date || t.date < trip.trip.start)],
    ...days.map((d): [string, TodoT[]] => [d, visible.filter((t) => t.date === d)]),
  ]
  const open = trip.todos.filter((t) => !t.done).length

  return (
    <div class="view">
      <div class="view-head">
        <h1>To-do</h1>
        <span class="muted">{open} open</span>
      </div>
      <AddTodo days={days} defaultDate={today >= trip.trip.start && today <= trip.trip.end ? today : ''} />
      <label class="toggle">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone((e.target as HTMLInputElement).checked)} /> Hide
        done
      </label>
      {groups
        .filter(([, list]) => list.length)
        .map(([label, list]) => (
          <section key={label}>
            <h2 class={label === today ? 'is-today' : ''}>{label.match(/^\d{4}-/) ? formatDay(label) : label}</h2>
            <TodoList todos={list} />
          </section>
        ))}
    </div>
  )
}

function AddTodo({ days, defaultDate }: { days: string[]; defaultDate: string }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(defaultDate)
  return (
    <form
      class="add-todo"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        addTodo(text.trim(), date || undefined)
        setText('')
      }}
    >
      <input placeholder="New to-do…" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
      <select value={date} onChange={(e) => setDate((e.target as HTMLSelectElement).value)}>
        <option value="">Anytime</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {formatDay(d)}
          </option>
        ))}
      </select>
      <button class="btn primary">Add</button>
    </form>
  )
}
