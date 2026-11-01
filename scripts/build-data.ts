// Validates data/trip.yaml, inlines attachments and writes the encrypted blob the app loads.
//
//   npm run build:data              -> public/trip.enc (asks for the passphrase; this file is committed)
//   npm run build:data -- --dev     -> data/trip.dev.enc (passphrase "dev" or $TRIP_DEV_PASSPHRASE; gitignored,
//                                      served by `npm run dev` instead of public/trip.enc)
//   npm run check:data              -> validate + print a summary, write nothing
//
// Options: --src <yaml>  --out <file>  --new-passphrase (new salt; phones must unlock again)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { parse } from 'yaml'
import { tripSchema, type Trip } from '../src/schema.ts'
import { DEFAULT_ITERATIONS, decryptJson, deriveKey, encryptJson, parseHeader } from '../src/crypto.ts'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const dev = flag('--dev')
const checkOnly = flag('--check')
const src = resolve(opt('--src') ?? 'data/trip.yaml')
const out = resolve(opt('--out') ?? (dev ? 'data/trip.dev.enc' : 'public/trip.enc'))
const attachmentsDir = join(dirname(src), 'attachments')

const mime: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}

function fail(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

// ---------- load + validate ----------
if (!existsSync(src)) fail(`${src} not found`)
const parsed = tripSchema.safeParse(parse(readFileSync(src, 'utf8')))
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  fail('trip data is invalid')
}
const trip: Trip = parsed.data

const warnings: string[] = []
const ids = new Set<string>()
for (const item of trip.items) {
  if (ids.has(item.id)) fail(`duplicate item id "${item.id}"`)
  ids.add(item.id)
  if (item.date < trip.trip.start || item.date > trip.trip.end) warnings.push(`${item.id}: date ${item.date} is outside the trip`)
  if ('bookedVia' in item && item.bookedVia && !trip.ticketGuides[item.bookedVia])
    warnings.push(`${item.id}: bookedVia "${item.bookedVia}" has no ticketGuides entry`)
  if (item.type === 'stay' && item.until <= item.date) fail(`${item.id}: check-out must be after check-in`)
}
for (const todo of trip.todos) {
  if (ids.has(todo.id)) fail(`todo id "${todo.id}" clashes with another id`)
  ids.add(todo.id)
  if (todo.itemId && !trip.items.some((i) => i.id === todo.itemId))
    warnings.push(`todo ${todo.id}: unknown itemId ${todo.itemId}`)
}
for (const acc of trip.accounts)
  if (acc.guide && !trip.ticketGuides[acc.guide]) warnings.push(`account ${acc.name}: unknown guide "${acc.guide}"`)

// Nights without a stay (excluding the last day and nights spent on a plane/night bus).
for (let d = trip.trip.start; d < trip.trip.end; d = addDays(d, 1)) {
  const sleeping = trip.items.some(
    (i) => (i.type === 'stay' && i.date <= d && d < i.until) || ('to' in i && i.date <= d && (i.to.date ?? i.date) > d),
  )
  if (!sleeping) warnings.push(`night of ${d}: no stay`)
}

// ---------- attachments ----------
let attachmentBytes = 0
for (const item of trip.items) {
  for (const a of item.attachments) {
    const path = join(attachmentsDir, a.file)
    if (!existsSync(path)) fail(`${item.id}: attachment ${path} not found`)
    const type = mime[extname(path).toLowerCase()] ?? fail(`${item.id}: unsupported attachment type ${path}`)
    const bytes = readFileSync(path)
    attachmentBytes += bytes.length
    if (!checkOnly) a.file = `data:${type};base64,${bytes.toString('base64')}`
  }
}

// ---------- summary ----------
const counts = trip.items.reduce<Record<string, number>>((acc, i) => ((acc[i.type] = (acc[i.type] ?? 0) + 1), acc), {})
const open = trip.items.filter((i) => i.status !== 'booked').length
console.log(`${trip.trip.title}: ${trip.trip.start} → ${trip.trip.end}`)
console.log(
  `  ${Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')} · ${open} not yet booked · ${trip.todos.length} todos · ` +
    `${trip.accounts.length} accounts · attachments ${(attachmentBytes / 1024).toFixed(0)} KB`,
)
for (const w of warnings) console.log(`  \x1b[33m! ${w}\x1b[0m`)
if (checkOnly) process.exit(0)

// ---------- encrypt ----------
const embedded = { ...trip, builtAt: new Date().toISOString() }

let salt: Uint8Array<ArrayBuffer>
let iterations = DEFAULT_ITERATIONS
let key: CryptoKey
const previous = existsSync(out) && !flag('--new-passphrase') ? new Uint8Array(readFileSync(out)) : undefined

if (dev) {
  const pass = process.env.TRIP_DEV_PASSPHRASE ?? 'dev'
  salt = previous ? parseHeader(previous).salt : crypto.getRandomValues(new Uint8Array(16))
  key = await deriveKey(pass, salt, iterations)
} else if (previous) {
  // Re-use the salt so phones that already unlocked keep working, and prove the passphrase matches.
  ;({ salt, iterations } = parseHeader(previous))
  const pass = await askPassphrase('Passphrase: ')
  key = await deriveKey(pass, salt, iterations)
  try {
    await decryptJson(previous, key)
  } catch {
    fail(`passphrase does not match the existing ${out}. Use --new-passphrase to switch (phones will need to unlock again).`)
  }
} else {
  console.log('Choose the passphrase for the app. The blob is public: use 5+ random words.')
  const pass = await askPassphrase('New passphrase: ')
  if (pass.length < 20) fail('passphrase too short (min 20 characters)')
  if ((await askPassphrase('Repeat: ')) !== pass) fail('passphrases differ')
  salt = crypto.getRandomValues(new Uint8Array(16))
  key = await deriveKey(pass, salt, iterations)
}

const blob = await encryptJson(embedded, key, salt, iterations)
writeFileSync(out, blob)
console.log(`\x1b[32m✓ wrote ${out} (${(blob.length / 1024).toFixed(0)} KB)\x1b[0m`)

// ---------- helpers ----------
function addDays(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

function askPassphrase(prompt: string): Promise<string> {
  if (process.env.TRIP_PASSPHRASE) return Promise.resolve(process.env.TRIP_PASSPHRASE)
  const stdin = process.stdin
  if (!stdin.isTTY) fail('no TTY for the passphrase prompt (or set TRIP_PASSPHRASE)')
  process.stdout.write(prompt)
  return new Promise((done) => {
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return done(value)
        }
        if (ch === '\u0003') process.exit(130)
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}
