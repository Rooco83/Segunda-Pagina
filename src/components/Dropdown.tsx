import { useEffect, useRef, useState } from 'react'

interface Opt {
  value: string
  label: string
}

/** Desplegable propio (no usa <select> nativo, que no abre en algunos entornos). */
export function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: Opt[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])

  const cur = options.find((o) => o.value === value)

  return (
    <div className="dd" ref={ref}>
      <button type="button" className="select dd-btn" onClick={() => setOpen((o) => !o)}>
        <span>{cur?.label ?? '—'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="dd-menu">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`dd-item ${o.value === value ? 'sel' : ''}`}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
