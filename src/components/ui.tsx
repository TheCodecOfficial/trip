import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { Status } from '../schema.ts'
import { statusLabel } from '../constants.ts'

// ---------- toast ----------

let showToast: (msg: string) => void = () => {}
export const toast = (msg: string) => showToast(msg)

export function Toaster() {
  const [msg, setMsg] = useState<string>()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    showToast = (m) => {
      setMsg(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(undefined), 1800)
    }
  }, [])
  return msg ? <div class="toast">{msg}</div> : null
}

// ---------- small pieces ----------

export function StatusBadge({ status }: { status: Status }) {
  return <span class={`badge status-${status}`}>{status === 'booked' ? '✓ Booked' : statusLabel[status]}</span>
}

/** Tap to copy, e.g. confirmation numbers or the Japanese address. */
export function Copy({ text, children }: { text: string; children?: ComponentChildren }) {
  return (
    <button
      type="button"
      class="copy"
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          toast('Copied')
        } catch {
          toast('Copy failed')
        }
      }}
    >
      {children ?? text}
      <span class="copy-icon" aria-hidden>
        ⧉
      </span>
    </button>
  )
}

export function ExtLink({ href, children, class: cls = 'btn' }: { href: string; children: ComponentChildren; class?: string }) {
  return (
    <a class={cls} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  )
}

export function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="row">
      <span class="row-label">{label}</span>
      <span class="row-value">{children}</span>
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Renders "- " lines as bullets, blank lines as paragraph breaks. */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div class="rich">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const bullets = lines.filter((l) => /^\s*[-•]\s/.test(l))
        const prose = lines.filter((l) => !/^\s*[-•]\s/.test(l)).join(' ')
        return (
          <div key={i}>
            {prose && <p>{prose}</p>}
            {bullets.length > 0 && (
              <ul>
                {bullets.map((b, j) => (
                  <li key={j}>{b.replace(/^\s*[-•]\s/, '')}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
