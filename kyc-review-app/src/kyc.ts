import { read, utils } from 'xlsx'
import workbookUrl from '../../KYC_review.xlsx?url'

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

interface RawRow {
  id: number
  'Customer Name': string
  'Name Read From Id': string
  'Credit Score'?: number
  'Sanctions from data source 1': string
  'Sanctions from data source 2': string
  Status: string
  Reason: string
  'Entered Queue': Date
}

export type KycStatus = 'FLAGGED' | 'APPROVED' | 'REJECTED'

export async function updateKycStatus(id: number, status: KycStatus): Promise<void> {
  const response = await fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Failed to update status: ${response.status}`)
  }
}

export async function loadKycRecords(): Promise<KycRecord[]> {
  const response = await fetch(workbookUrl)
  if (!response.ok) throw new Error(`Failed to load workbook: ${response.status}`)
  const workbook = read(await response.arrayBuffer(), { cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<RawRow>(sheet)
  return rows
    .map((row) => ({
      id: row.id,
      customerName: row['Customer Name'],
      nameReadFromId: row['Name Read From Id'],
      creditScore: row['Credit Score'] ?? null,
      sanctionsSource1: row['Sanctions from data source 1'],
      sanctionsSource2: row['Sanctions from data source 2'],
      status: row.Status,
      reason: row.Reason,
      enteredQueue: row['Entered Queue'],
    }))
    .sort((a, b) => a.enteredQueue.getTime() - b.enteredQueue.getTime())
}
