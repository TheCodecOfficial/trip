import { useState } from 'preact/hooks'
import type { Item } from '../schema.ts'
import { statuses, statusLabel, ticketForms, ticketFormLabel } from '../constants.ts'
import { getState, isBaseItem, isEdited, removeItem, resetItem, saveItem } from '../store.ts'
import { Sheet, toast } from './ui.tsx'

type Kind = 'text' | 'time' | 'date' | 'textarea' | 'status' | 'ticketForm' | 'guide'
type Field = [path: string, label: string, kind?: Kind]

const common: Field[] = [
  ['status', 'Status', 'status'],
  ['date', 'Date', 'date'],
]
const transport: Field[] = [
  ['from.place', 'From'],
  ['from.time', 'Departs', 'time'],
  ['from.detail', 'Platform / terminal'],
  ['to.place', 'To'],
  ['to.time', 'Arrives', 'time'],
  ['service', 'Train / flight no.'],
  ['class', 'Class'],
  ['car', 'Car'],
  ['seat', 'Seat'],
  ['bookedVia', 'Booked via', 'guide'],
  ['ticketForm', 'Ticket', 'ticketForm'],
  ['confirmation', 'Confirmation no.'],
  ['price', 'Price'],
]
const fields: Record<Item['type'], Field[]> = {
  train: [...common, ...transport],
  bus: [...common, ['title', 'Title'], ...transport],
  flight: [...common, ...transport, ['baggage', 'Baggage']],
  activity: [
    ...common,
    ['name', 'Name'],
    ['start', 'Start', 'time'],
    ['end', 'End', 'time'],
    ['place', 'Place'],
    ['ticketUrl', 'Ticket link'],
    ['confirmation', 'Confirmation no.'],
  ],
  stay: [
    ...common,
    ['until', 'Check-out date', 'date'],
    ['name', 'Name'],
    ['checkIn', 'Check-in time'],
    ['checkOut', 'Check-out time'],
    ['address', 'Address'],
    ['confirmation', 'Confirmation no.'],
    ['pin', 'PIN'],
    ['payment', 'Payment'],
  ],
}

const get = (obj: Record<string, any>, path: string): string => path.split('.').reduce<any>((o, k) => o?.[k], obj) ?? ''

function setPath(obj: Record<string, any>, path: string, value: string) {
  const keys = path.split('.')
  const last = keys.pop()!
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj)
  if (value.trim()) target[last] = value
  else delete target[last]
}

export function newItem(type: Item['type'], date: string): Item {
  const id = `local-${Date.now().toString(36)}`
  const base = { id, date, status: 'planned' as const, links: [], attachments: [] }
  if (type === 'activity') return { ...base, type, name: '' }
  if (type === 'stay') return { ...base, type, name: '', until: date }
  return { ...base, type, from: { place: '' }, to: { place: '' } }
}

export function EditSheet({ item, onClose, isNew }: { item: Item; onClose: () => void; isNew?: boolean }) {
  const [draft, setDraft] = useState<Record<string, any>>(() => structuredClone(item))
  const guides = getState().trip?.ticketGuides ?? {}
  const base = isBaseItem(item.id)

  const change = (path: string, value: string) =>
    setDraft((d) => {
      const next = structuredClone(d)
      setPath(next, path, value)
      return next
    })

  const save = (e: Event) => {
    e.preventDefault()
    saveItem(draft as Item)
    toast('Saved on this phone')
    onClose()
  }

  return (
    <Sheet title={isNew ? 'Add' : 'Edit'} onClose={onClose}>
      <form class="form" onSubmit={save}>
        {fields[item.type].map(([path, label, kind = 'text']) => {
          const value = get(draft, path)
          const onInput = (e: Event) => change(path, (e.target as HTMLInputElement).value)
          let input
          if (kind === 'status' || kind === 'ticketForm') {
            const opts = kind === 'status' ? statuses : ticketForms
            const labels: Record<string, string> = kind === 'status' ? statusLabel : ticketFormLabel
            input = (
              <select value={value} onChange={onInput}>
                {kind === 'ticketForm' && <option value="">—</option>}
                {opts.map((o) => (
                  <option key={o} value={o}>
                    {labels[o]}
                  </option>
                ))}
              </select>
            )
          } else if (kind === 'guide') {
            input = (
              <select value={value} onChange={onInput}>
                <option value="">—</option>
                {Object.entries(guides).map(([k, g]) => (
                  <option key={k} value={k}>
                    {g.name}
                  </option>
                ))}
              </select>
            )
          } else if (kind === 'textarea') {
            input = <textarea value={value} onInput={onInput} rows={3} />
          } else {
            input = <input type={kind as 'text'} value={value} onInput={onInput} required={path === 'date' || path === 'until'} />
          }
          return (
            <label key={path} class="field">
              <span>{label}</span>
              {input}
            </label>
          )
        })}
        <label class="field">
          <span>Notes</span>
          <textarea
            value={get(draft, 'notes')}
            onInput={(e) => change('notes', (e.target as HTMLTextAreaElement).value)}
            rows={4}
          />
        </label>
        <div class="actions">
          <button type="submit" class="btn primary">
            Save
          </button>
          {base && isEdited(item.id) && (
            <button
              type="button"
              class="btn"
              onClick={() => {
                resetItem(item.id)
                toast('Restored original')
                onClose()
              }}
            >
              Undo my edits
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                if (!confirm(base ? 'Hide this item on this phone?' : 'Delete this item?')) return
                removeItem(item.id)
                onClose()
              }}
            >
              {base ? 'Hide' : 'Delete'}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
