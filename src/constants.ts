// Shared enums; kept out of schema.ts so the app bundle doesn't pull in zod.
export const statuses = ['booked', 'planned', 'buy-on-site', 'pickup-needed'] as const
export const ticketForms = ['ic', 'eticket', 'pickup', 'qr', 'paper', 'credit-card', 'pass', 'none', 'other'] as const

export const statusLabel: Record<(typeof statuses)[number], string> = {
  booked: 'Booked',
  planned: 'Planned',
  'buy-on-site': 'Buy at machine',
  'pickup-needed': 'Pick up ticket',
}

export const ticketFormLabel: Record<(typeof ticketForms)[number], string> = {
  ic: 'On IC card',
  eticket: 'E-ticket on phone',
  pickup: 'Pick up at machine',
  qr: 'QR code',
  paper: 'Paper ticket',
  'credit-card': 'Pick up with credit card',
  pass: 'Rail pass',
  none: 'No ticket needed',
  other: 'Other',
}
