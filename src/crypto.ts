// Encrypted blob format, shared by scripts/build-data.ts (Node) and the app (browser).
//
//   "TRP1" | iterations (uint32 BE) | salt (16) | iv (12) | AES-256-GCM(gzip(JSON))
//
// The key comes from PBKDF2-SHA256(passphrase, salt). The salt is kept stable between data builds,
// so a key remembered on the phone keeps working after data updates.

const MAGIC = [0x54, 0x52, 0x50, 0x31] // "TRP1"
const HEADER = 4 + 4 + 16 + 12
export const DEFAULT_ITERATIONS = 600_000

export interface BlobHeader {
  iterations: number
  salt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

export function parseHeader(blob: Uint8Array): BlobHeader {
  if (blob.length < HEADER || MAGIC.some((b, i) => blob[i] !== b)) throw new Error('Not a trip data file')
  const iterations = new DataView(blob.buffer, blob.byteOffset + 4, 4).getUint32(0)
  return { iterations, salt: blob.slice(8, 24), iv: blob.slice(24, 36) }
}

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: can be stored in IndexedDB but never read back out
    ['encrypt', 'decrypt'],
  )
}

async function pipe(
  data: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([data]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encryptJson(
  value: unknown,
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('gzip'))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const out = new Uint8Array(HEADER + cipher.length)
  out.set(MAGIC, 0)
  new DataView(out.buffer).setUint32(4, iterations)
  out.set(salt, 8)
  out.set(iv, 24)
  out.set(cipher, HEADER)
  return out
}

/** Throws if the key is wrong (GCM authentication fails). */
export async function decryptJson<T>(blob: Uint8Array, key: CryptoKey): Promise<T> {
  const { iv } = parseHeader(blob)
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, blob.slice(HEADER)))
  const json = await pipe(plain, new DecompressionStream('gzip'))
  return JSON.parse(new TextDecoder().decode(json)) as T
}

export const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])
