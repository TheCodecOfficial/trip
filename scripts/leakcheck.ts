// Proves that no plaintext trip data is in git (all history, index, working tree) or in dist/.
//
//   npm run leakcheck [-- --src data/trip.yaml]
//
// Every string value from trip.yaml is searched for, case-insensitively: all values of 8+ chars, and
// shorter ones (5+) that contain a digit, like booking codes. Generic short words would only add noise. Public strings that
// may legitimately appear (e.g. a service's homepage URL) can be listed one per line in
// data/leakcheck-allow.txt, which is gitignored like the rest of data/.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { statuses, ticketForms } from '../src/constants.ts'

const args = process.argv.slice(2)
const srcIdx = args.indexOf('--src')
const src = resolve(srcIdx >= 0 ? args[srcIdx + 1] : 'data/trip.yaml')
const allowFile = 'data/leakcheck-allow.txt'
const patternFile = 'data/.leakcheck-patterns' // inside the ignored folder, deleted afterwards

if (!existsSync(src)) {
  console.error(`${src} not found`)
  process.exit(1)
}

// ---------- collect sensitive strings ----------
const ignore = new Set<string>([...statuses, ...ticketForms])
if (existsSync(allowFile))
  for (const line of readFileSync(allowFile, 'utf8').split('\n')) if (line.trim()) ignore.add(line.trim().toLowerCase())

const patterns = new Set<string>()
const add = (v: string) => {
  for (const line of v.split('\n')) {
    const s = line.trim()
    const long = s.length >= 8 || (s.length >= 5 && /\d/.test(s))
    const timeOrDate = /^(\d{1,2}:\d{2}([–-]\d{1,2}:\d{2})?|\d{4}-\d{2}-\d{2}|[+-]\d{2}:\d{2})$/.test(s)
    if (long && !timeOrDate && !ignore.has(s.toLowerCase())) patterns.add(s)
  }
}
const walk = (v: unknown, key = '') => {
  if (key === 'type') return // item kinds (train, activity, ...) are schema words, not data
  if (typeof v === 'string') add(v)
  else if (typeof v === 'number') add(String(v))
  else if (Array.isArray(v)) v.forEach((x) => walk(x))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  // Attachment file names can be telling too.
  if (key === 'file' && typeof v === 'string') add(v.replace(/\.[a-z]+$/i, ''))
}
walk(parse(readFileSync(src, 'utf8')))

const redact = (s: string) => `${s.slice(0, 4)}… (${s.length} chars)`
const problems: string[] = []
const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 })

// ---------- 1. no private paths anywhere in history ----------
const paths = new Set(git('log', '--all', '--name-only', '--format=').split('\n').filter(Boolean))
for (const p of git('ls-files', '--cached').split('\n').filter(Boolean)) paths.add(p)
for (const p of paths) {
  if (/^(data|sources)\//.test(p) || /\.(eml|msg|pdf|ya?ml\.bak)$/i.test(p)) problems.push(`private path in git: ${p}`)
}

// ---------- 2. no plaintext values in any committed/staged/working file ----------
writeFileSync(patternFile, [...patterns].join('\n'))
try {
  const revs = git('rev-list', '--all').split('\n').filter(Boolean)
  const search = (extra: string[]) => {
    try {
      return git('grep', '-I', '-F', '-i', '-o', '-z', '-f', patternFile, ...extra)
    } catch (e: any) {
      if (e.status === 1) return '' // git grep: no matches
      throw e
    }
  }
  const hits = [
    ...(revs.length ? search(revs).split('\n') : []),
    ...search(['--cached']).split('\n'),
    ...search(['--untracked']).split('\n'),
  ].filter(Boolean)
  // With -z each hit is "[rev:]path\0match".
  for (const hit of new Set(hits)) {
    const [where, value = ''] = hit.split('\0')
    problems.push(`"${redact(value)}" found in ${where}`)
  }
} finally {
  rmSync(patternFile, { force: true })
}

// ---------- 3. no plaintext values in the build output ----------
const lower = [...patterns].map((p) => p.toLowerCase())
const scan = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) scan(p)
    else if (!p.endsWith('.enc')) {
      const text = readFileSync(p, 'latin1').toLowerCase()
      for (const pat of lower) if (text.includes(pat)) problems.push(`"${redact(pat)}" found in ${p}`)
    }
  }
}
if (existsSync('dist')) scan('dist')

// ---------- 4. the shipped blob is really encrypted ----------
for (const blob of ['public/trip.enc', 'dist/trip.enc']) {
  if (!existsSync(blob)) continue
  const bytes = readFileSync(blob)
  if (bytes.subarray(0, 4).toString('latin1') !== 'TRP1') problems.push(`${blob} has no TRP1 header`)
  const text = bytes.toString('latin1').toLowerCase()
  for (const pat of lower) if (text.includes(pat)) problems.push(`"${redact(pat)}" readable inside ${blob}`)
}

// ---------- report ----------
console.log(
  `Checked ${patterns.size} values from ${src} against ${paths.size} paths in git history${existsSync('dist') ? ' and dist/' : ''}.`,
)
if (problems.length) {
  for (const p of problems) console.log(`\x1b[31m✗ ${p}\x1b[0m`)
  console.log(`\n${problems.length} problem(s). Public strings can be allow-listed in ${allowFile}.`)
  process.exit(1)
}
console.log('\x1b[32m✓ no plaintext trip data found\x1b[0m')
