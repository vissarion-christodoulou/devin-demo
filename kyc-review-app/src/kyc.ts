export type KycStatus = 'FLAGGED' | 'APPROVED' | 'REJECTED'

export interface KycRecord {
  id: number
  customerName: string
  nameReadFromId: string
  creditScore: number | null
  sanctionsSource1: string
  sanctionsSource2: string
  status: string
  reason: string
  enteredQueue: Date
}

type SerializedRecord = Omit<KycRecord, 'enteredQueue'> & { enteredQueue: string }

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(body?.error ?? `${fallback}: ${response.status}`)
}

export async function updateKycStatus(id: number, status: KycStatus): Promise<void> {
  const response = await fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!response.ok) throw await failure(response, 'Failed to update status')
}

export async function loadKycRecords(): Promise<KycRecord[]> {
  const response = await fetch('/api/records')
  if (!response.ok) throw await failure(response, 'Failed to load records')
  const records = (await response.json()) as SerializedRecord[]
  return records
    .map((record) => ({ ...record, enteredQueue: new Date(record.enteredQueue) }))
    .sort((a, b) => a.enteredQueue.getTime() - b.enteredQueue.getTime())
}
