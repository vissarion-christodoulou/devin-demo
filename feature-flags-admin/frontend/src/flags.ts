export interface Flag {
  key: string
  label: string
  description: string
  enabled: boolean
}

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null
  return new Error(body?.detail ?? `${fallback}: ${response.status}`)
}

export async function loadFlags(): Promise<Flag[]> {
  const response = await fetch('/api/flags')
  if (!response.ok) throw await failure(response, 'Failed to load flags')
  return (await response.json()) as Flag[]
}

export async function setFlag(key: string, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/flags/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) throw await failure(response, 'Failed to update flag')
}
