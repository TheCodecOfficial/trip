import { useState } from 'preact/hooks'
import type { Activity, Item, Stay, Stop, Transport } from '../schema.ts'
import { ticketFormLabel } from '../constants.ts'
import { formatDay } from '../dates.ts'
import { getState, isEdited } from '../store.ts'
import { itemTitle, type Role } from '../timeline.ts'
import { Copy, ExtLink, RichText, Row, StatusBadge } from './ui.tsx'
import { EditSheet } from './EditSheet.tsx'

const icons: Record<Item['type'], string> = { train: '🚄', bus: '🚌', flight: '✈️', activity: '🎟️', stay: '🏨' }

interface Props {
  item: Item
  role?: Role
  time?: string
  open?: boolean
  past?: boolean
  next?: string // countdown label for the next thing today
}

export function ItemCard({ item, role = 'event', time, open: initiallyOpen = false, past, next }: Props) {
  const [open, setOpen] = useState(initiallyOpen)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <article class={`card type-${item.type}${past ? ' past' : ''}${next ? ' next' : ''}`}>
        {next && <div class="next-ribbon">Next · {next}</div>}
        <header class="card-head" onClick={() => setOpen(!open)}>
          <div class="card-time">
            {role === 'checkin' && time && <small>from</small>}
            {role === 'checkout' && time && <small>by</small>}
            <span>{time ?? '—'}</span>
            {role === 'event' && 'to' in item && item.to.time && (
              <small>
                → {item.to.time}
                {item.to.date && item.to.date !== item.date ? ' +1' : ''}
              </small>
            )}
            {item.type === 'activity' && item.end && <small>– {item.end}</small>}
          </div>
          <div class="card-main">
            <div class="card-title">
              <span class="card-icon" aria-hidden>
                {icons[item.type]}
              </span>
              {itemTitle(item)}
            </div>
            <div class="card-sub">{subtitle(item, role)}</div>
          </div>
          {(item.status !== 'booked' || item.type !== 'stay') && <StatusBadge status={item.status} />}
        </header>
        {open && (
          <div class="card-body">
            {item.type === 'stay' ? (
              <StayBody stay={item} />
            ) : item.type === 'activity' ? (
              <ActivityBody a={item} />
            ) : (
              <TransportBody t={item} />
            )}
            {item.notes && <RichText text={item.notes} />}
            <Attachments item={item} />
            <div class="actions">
              {item.links.map((l) => (
                <ExtLink key={l.url} href={l.url}>
                  {l.label} ↗
                </ExtLink>
              ))}
              <button type="button" class="btn ghost" onClick={() => setEditing(true)}>
                ✎ Edit{isEdited(item.id) ? ' (edited)' : ''}
              </button>
            </div>
          </div>
        )}
      </article>
      {/* Outside the card so a dimmed (past) card doesn't dim the sheet too. */}
      {editing && <EditSheet item={item} onClose={() => setEditing(false)} />}
    </>
  )
}

function subtitle(item: Item, role: Role): string {
  if (item.type === 'stay') {
    if (role === 'checkin') return `Check-in${item.checkIn ? ` ${item.checkIn}` : ''} · until ${formatDay(item.until)}`
    if (role === 'checkout') return `Check-out${item.checkOut ? ` by ${item.checkOut}` : ''}`
    return item.address ?? ''
  }
  if (item.type === 'activity') return item.place ?? ''
  const seat = [item.car && `Car ${item.car}`, item.seat && `Seat ${item.seat}`].filter(Boolean).join(' ')
  const parts = [role === 'arrive' ? `Arrival · ${item.service ?? ''}` : item.service, item.class, seat]
  if (item.ticketForm && item.status === 'booked') parts.push(ticketFormLabel[item.ticketForm])
  return parts.filter(Boolean).join(' · ')
}

function StopRow({ label, stop, date }: { label: string; stop: Stop; date: string }) {
  return (
    <Row label={label}>
      <strong>{stop.place}</strong>
      {stop.placeJa && <span class="ja"> {stop.placeJa}</span>}
      <br />
      {[
        stop.date && stop.date !== date ? formatDay(stop.date) : '',
        stop.time,
        stop.tz && stop.tz !== '+09:00' ? `(UTC${stop.tz})` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {stop.detail && <span class="muted"> · {stop.detail}</span>}
    </Row>
  )
}

function TransportBody({ t }: { t: Transport }) {
  const guide = t.bookedVia ? getState().trip?.ticketGuides[t.bookedVia] : undefined
  return (
    <>
      <div class="rows">
        <StopRow label="From" stop={t.from} date={t.date} />
        <StopRow label="To" stop={t.to} date={t.date} />
        {t.service && (
          <Row label={t.type === 'flight' ? 'Flight' : 'Service'}>{[t.operator, t.service].filter(Boolean).join(' ')}</Row>
        )}
        {t.class && <Row label="Class">{t.class}</Row>}
        {(t.car || t.seat) && (
          <Row label="Seat">
            <strong>{[t.car && `Car ${t.car}`, t.seat].filter(Boolean).join(' · ')}</strong>
          </Row>
        )}
        {t.confirmation && (
          <Row label="Booking">
            <Copy text={t.confirmation} />
          </Row>
        )}
        {t.type === 'flight' && t.baggage && <Row label="Baggage">{t.baggage}</Row>}
        {t.price && <Row label="Price">{t.price}</Row>}
      </div>
      {(guide || t.ticketForm) && (
        <div class="ticket-box">
          <div class="ticket-head">
            🎫 {[guide?.name ?? t.bookedVia, t.ticketForm && ticketFormLabel[t.ticketForm]].filter(Boolean).join(' · ')}
          </div>
          {guide && <p>{guide.summary}</p>}
          {guide && guide.steps.length > 0 && (
            <details>
              <summary>How it works</summary>
              <ol>
                {guide.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </>
  )
}

const mapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

function Address({ en, ja }: { en?: string; ja?: string }) {
  if (!en && !ja) return null
  return (
    <Row label="Address">
      {en && <div>{en}</div>}
      {ja && <Copy text={ja}>{<span class="ja">{ja}</span>}</Copy>}
    </Row>
  )
}

function ActivityBody({ a }: { a: Activity }) {
  const maps = a.mapsUrl ?? (a.addressJa || a.address ? mapsSearch(a.addressJa ?? a.address!) : undefined)
  return (
    <>
      <div class="rows">
        {(a.start || a.end) && <Row label="Time">{[a.start, a.end].filter(Boolean).join(' – ')}</Row>}
        {a.place && <Row label="Place">{a.place}</Row>}
        <Address en={a.address} ja={a.addressJa} />
        {a.confirmation && (
          <Row label="Booking">
            <Copy text={a.confirmation} />
          </Row>
        )}
        {a.price && <Row label="Price">{a.price}</Row>}
      </div>
      <div class="actions">
        {a.ticketUrl && (
          <ExtLink href={a.ticketUrl} class="btn primary">
            Open ticket ↗
          </ExtLink>
        )}
        {maps && <ExtLink href={maps}>Map ↗</ExtLink>}
      </div>
    </>
  )
}

function StayBody({ stay }: { stay: Stay }) {
  const maps = stay.mapsUrl ?? (stay.addressJa || stay.address ? mapsSearch(stay.addressJa ?? stay.address!) : undefined)
  return (
    <>
      <div class="rows">
        <Row label="Check-in">
          {formatDay(stay.date)}
          {stay.checkIn && ` · ${stay.checkIn}`}
        </Row>
        <Row label="Check-out">
          {formatDay(stay.until)}
          {stay.checkOut && ` · by ${stay.checkOut}`}
        </Row>
        <Address en={stay.address} ja={stay.addressJa} />
        {stay.phone && (
          <Row label="Phone">
            <a href={`tel:${stay.phone.replace(/[^\d+]/g, '')}`}>{stay.phone}</a>
          </Row>
        )}
        {stay.confirmation && (
          <Row label="Booking">
            <Copy text={stay.confirmation} />
          </Row>
        )}
        {stay.pin && (
          <Row label="PIN">
            <Copy text={stay.pin} />
          </Row>
        )}
        {stay.payment && <Row label="Payment">{stay.payment}</Row>}
      </div>
      {maps && (
        <div class="actions">
          <ExtLink href={maps} class="btn primary">
            Map ↗
          </ExtLink>
        </div>
      )}
    </>
  )
}

function Attachments({ item }: { item: Item }) {
  const [zoom, setZoom] = useState<string>()
  if (!item.attachments.length) return null
  return (
    <div class="attachments">
      {item.attachments.map((a) =>
        a.file.startsWith('data:image/') ? (
          <button type="button" key={a.label} class="thumb" onClick={() => setZoom(a.file)}>
            <img src={a.file} alt={a.label} />
            <span>{a.label}</span>
          </button>
        ) : (
          <button type="button" key={a.label} class="btn" onClick={() => openDataUrl(a.file, a.label)}>
            📄 {a.label}
          </button>
        ),
      )}
      {zoom && (
        <div class="lightbox" onClick={() => setZoom(undefined)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  )
}

async function openDataUrl(dataUrl: string, label: string) {
  // Chrome blocks navigating to data: URLs, so go through a blob.
  const blob = await (await fetch(dataUrl)).blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${label}.${blob.type.split('/')[1] ?? 'bin'}`
  a.target = '_blank'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}
