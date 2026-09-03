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

/** Subscribes to the flag stream, so every open admin tab stays in sync. */
export function subscribeToFlags(
  onChange: (flags: Flag[]) => void,
  onError: (message: string) => void,
): () => void {
  const source = new EventSource('/api/flags/stream')
  source.onmessage = (event) => onChange(JSON.parse(event.data) as Flag[])
  source.onerror = () => onError('Lost connection to the flag service, retrying…')
  return () => source.close()
}

export async function setFlag(key: string, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/flags/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) throw await failure(response, 'Failed to update flag')
}
