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
  average: number
}

const HOUR = 3_600_000

/**
 * Time-weighted average number of flagged cases in each of the last 24 hourly buckets: every
 * record contributes the fraction of the bucket it spent waiting, between entering the queue
 * and being decided (or now, if it is still flagged).
 */
export function hourlyQueueSize(records: KycRecord[], now = new Date()): HourlyQueueSize[] {
  const latest = Math.floor(now.getTime() / HOUR) * HOUR
  return Array.from({ length: 24 }, (_, index) => {
    const start = latest - (23 - index) * HOUR
    const end = Math.min(start + HOUR, now.getTime())
    const waiting = records.reduce((sum, record) => {
      const from = Math.max(record.enteredQueue.getTime(), start)
      const to = Math.min(record.decidedAt?.getTime() ?? now.getTime(), end)
      return sum + Math.max(0, to - from)
    }, 0)
    return { hour: new Date(start), average: end > start ? waiting / (end - start) : 0 }
  })
}

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(body?.error ?? `${fallback}: ${response.status}`)
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
