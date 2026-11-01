// Trip data schema. Used by scripts/build-data.ts for validation; the app only imports the types.
import { z } from 'zod'
import { statuses, ticketForms } from './constants.ts'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const time = z.string().regex(/^\d{1,2}:\d{2}$/, 'expected HH:MM')
// UTC offset of a local time, e.g. "+01:00". Defaults to Japan (+09:00) everywhere.
const tz = z.string().regex(/^[+-]\d{2}:\d{2}$/, 'expected +HH:MM')

const link = z.object({ label: z.string(), url: z.string() })

// In trip.yaml `file` is a path below data/attachments/; build-data inlines it as a data: URL.
const attachment = z.object({ label: z.string(), file: z.string() })

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/, 'ids are lowercase-kebab'),
  date,
  status: z.enum(statuses).default('booked'),
  title: z.string().optional(),
  confirmation: z.string().optional(),
  price: z.string().optional(),
  notes: z.string().optional(),
  links: z.array(link).default([]),
  attachments: z.array(attachment).default([]),
}

const stop = z.object({
  place: z.string(),
  placeJa: z.string().optional(),
  time: time.optional(),
  date: date.optional(), // only when different from the item's date (overnight)
  tz: tz.optional(),
  detail: z.string().optional(), // platform, terminal, exit, ...
})

const transport = {
  ...base,
  from: stop,
  to: stop,
  service: z.string().optional(), // "Hikari 637", "Highway bus 12"
  operator: z.string().optional(),
  class: z.string().optional(), // "Reserved", "Green", "Non-reserved"
  car: z.string().optional(),
  seat: z.string().optional(),
  bookedVia: z.string().optional(), // key into ticketGuides
  ticketForm: z.enum(ticketForms).optional(),
}

export const trainSchema = z.object({ type: z.literal('train'), ...transport })
export const busSchema = z.object({ type: z.literal('bus'), ...transport })
export const flightSchema = z.object({
  type: z.literal('flight'),
  ...transport,
  baggage: z.string().optional(),
})
export const activitySchema = z.object({
  type: z.literal('activity'),
  ...base,
  name: z.string(),
  start: time.optional(),
  end: time.optional(),
  place: z.string().optional(),
  address: z.string().optional(),
  addressJa: z.string().optional(),
  mapsUrl: z.string().optional(),
  ticketUrl: z.string().optional(),
})
export const staySchema = z.object({
  type: z.literal('stay'),
  ...base,
  name: z.string(),
  until: date, // check-out date
  checkIn: z.string().optional(), // "15:00" or "15:00–22:00"
  checkOut: z.string().optional(),
  address: z.string().optional(),
  addressJa: z.string().optional(),
  phone: z.string().optional(),
  pin: z.string().optional(),
  payment: z.string().optional(), // "Paid", "Pay at property: ¥32,000"
  mapsUrl: z.string().optional(),
})

export const itemSchema = z.discriminatedUnion('type', [trainSchema, busSchema, flightSchema, activitySchema, staySchema])

export const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  date: date.optional(), // omitted = before the trip / anytime
  done: z.boolean().default(false),
  itemId: z.string().optional(),
})

export const tripSchema = z.object({
  trip: z.object({
    title: z.string(),
    start: date,
    end: date,
    homeCurrency: z.string().default('CHF'),
    jpyPerHome: z.number().positive(), // ¥ for one unit of home currency
  }),
  days: z.record(date, z.object({ city: z.string().optional(), note: z.string().optional() })).default({}),
  items: z.array(itemSchema).default([]),
  ticketGuides: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        summary: z.string(),
        steps: z.array(z.string()).default([]),
        url: z.string().optional(),
      }),
    )
    .default({}),
  accounts: z
    .array(z.object({ name: z.string(), url: z.string(), note: z.string().optional(), guide: z.string().optional() }))
    .default([]),
  todos: z.array(todoSchema).default([]),
  emergency: z
    .array(z.object({ name: z.string(), phone: z.string().optional(), url: z.string().optional(), note: z.string().optional() }))
    .default([]),
  info: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
})

export type Trip = z.infer<typeof tripSchema>
export type Item = z.infer<typeof itemSchema>
export type Transport = z.infer<typeof trainSchema> | z.infer<typeof busSchema> | z.infer<typeof flightSchema>
export type Activity = z.infer<typeof activitySchema>
export type Stay = z.infer<typeof staySchema>
export type Todo = z.infer<typeof todoSchema>
export type Status = (typeof statuses)[number]
export type TicketForm = (typeof ticketForms)[number]
export type Stop = z.infer<typeof stop>
