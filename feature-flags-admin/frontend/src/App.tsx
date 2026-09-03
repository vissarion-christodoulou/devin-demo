import { useEffect, useState } from 'react'
import { loadFlags, setFlag, type Flag } from './flags'

export default function App() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadFlags().then(setFlags, (e: Error) => setError(e.message))
  }, [])

  const toggle = async (flag: Flag) => {
    const enabled = !flag.enabled
    setSaving(flag.key)
    setError(null)
    try {
      await setFlag(flag.key, enabled)
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled } : f)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="page">
      <header>
        <h1>Feature Flags</h1>
        <p className="subtitle">Controls which graphs the refunds dashboard renders.</p>
      </header>
      {error && <p className="error">{error}</p>}
      <ul className="flags">
        {flags.map((flag) => (
          <li key={flag.key}>
            <label>
              <span className="text">
                <span className="label">{flag.label}</span>
                <span className="description">{flag.description}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={flag.enabled}
                disabled={saving === flag.key}
                onChange={() => toggle(flag)}
              />
              <span className="switch" aria-hidden="true" />
            </label>
          </li>
        ))}
      </ul>
      {flags.length === 0 && !error && <p className="placeholder">Loading flags…</p>}
    </div>
  )
}
