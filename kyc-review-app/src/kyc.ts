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
  decidedAt: Date | null
}

type SerializedRecord = Omit<KycRecord, 'enteredQueue' | 'decidedAt'> & {
  enteredQueue: string
  decidedAt: string | null
}

export interface HourlyQueueSize {
  hour: Date
  size: number
}

const HOUR = 3_600_000
export const QUEUE_HISTORY_HOURS = 48

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(body?.error ?? `${fallback}: ${response.status}`)
}

/** Cases waiting for a decision at each of the last 48 hourly marks, oldest first. */
export function hourlyQueueSize(records: KycRecord[], now = new Date()): HourlyQueueSize[] {
  const latest = Math.ceil(now.getTime() / HOUR) * HOUR
  return Array.from({ length: QUEUE_HISTORY_HOURS }, (_, index) => {
    const at = Math.min(latest - (QUEUE_HISTORY_HOURS - 1 - index) * HOUR, now.getTime())
    const size = records.filter(
      (record) =>
        record.enteredQueue.getTime() <= at && (record.decidedAt?.getTime() ?? Infinity) > at,
    ).length
    return { hour: new Date(at), size }
  })
}

export async function updateKycStatus(id: number, status: KycStatus): Promise<Date | null> {
  const response = await fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!response.ok) throw await failure(response, 'Failed to update status')
  const { decidedAt } = (await response.json()) as { decidedAt: string | null }
  return decidedAt ? new Date(decidedAt) : null
}

export async function loadKycRecords(): Promise<KycRecord[]> {
  const response = await fetch('/api/records')
  if (!response.ok) throw await failure(response, 'Failed to load records')
  const records = (await response.json()) as SerializedRecord[]
  return records
    .map((record) => ({
      ...record,
      enteredQueue: new Date(record.enteredQueue),
      decidedAt: record.decidedAt ? new Date(record.decidedAt) : null,
    }))
    .sort((a, b) => a.enteredQueue.getTime() - b.enteredQueue.getTime())
}
