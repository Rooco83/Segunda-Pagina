import { useStore } from '../store'
import { ACCENTS } from '../data/accents'

export function AccentSwitcher() {
  const accentKey = useStore((s) => s.accentKey)
  const setAccent = useStore((s) => s.setAccent)

  return (
    <div className="acc-switch">
      <span className="lab">Acento</span>
      {ACCENTS.map((a) => (
        <button
          key={a.key}
          className={`acc-dot ${a.key === accentKey ? 'active' : ''}`}
          style={{ background: a.c }}
          title={a.key}
          aria-label={`Acento ${a.key}`}
          onClick={() => setAccent(a.key)}
        />
      ))}
    </div>
  )
}
