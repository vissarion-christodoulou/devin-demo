import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { read, utils, write } from 'xlsx'

const WORKBOOK_PATH = fileURLToPath(new URL('./data/KYC_review.xlsx', import.meta.url))
const STATUSES = new Set(['FLAGGED', 'APPROVED', 'REJECTED'])
const DATE_FORMAT = 'yyyy-mm-dd hh:mm:ss'

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
  'Decided At'?: Date
}

function toSerial(date: Date): number {
  return 25569 + (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readRecords() {
  const workbook = read(readFileSync(WORKBOOK_PATH), { cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return utils.sheet_to_json<RawRow>(sheet).map((row) => ({
    id: row.id,
    customerName: row['Customer Name'],
    nameReadFromId: row['Name Read From Id'],
    creditScore: row['Credit Score'] ?? null,
    sanctionsSource1: row['Sanctions from data source 1'],
    sanctionsSource2: row['Sanctions from data source 2'],
    status: row.Status,
    reason: row.Reason,
    enteredQueue: row['Entered Queue'].toISOString(),
    decidedAt: row['Decided At']?.toISOString() ?? null,
  }))
}

function updateStatus(id: number, status: string): { decidedAt: Date | null } | null {
  const workbook = read(readFileSync(WORKBOOK_PATH), { cellNF: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const range = utils.decode_range(sheet['!ref']!)
  const headers: Record<string, number> = {}
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[utils.encode_cell({ r: range.s.r, c })]
    if (cell) headers[String(cell.v)] = c
  }
  const idCol = headers['id']
  const statusCol = headers['Status']
  const decidedCol = headers['Decided At']
  if (idCol === undefined || statusCol === undefined || decidedCol === undefined) return null
  const decidedAt = status === 'FLAGGED' ? null : new Date(Math.floor(Date.now() / 1000) * 1000)
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const idCell = sheet[utils.encode_cell({ r, c: idCol })]
    if (idCell?.v === id) {
      sheet[utils.encode_cell({ r, c: statusCol })] = { t: 's', v: status }
      sheet[utils.encode_cell({ r, c: decidedCol })] = decidedAt
        ? { t: 'n', v: toSerial(decidedAt), z: DATE_FORMAT }
        : { t: 'z' }
      writeFileSync(WORKBOOK_PATH, write(workbook, { type: 'buffer', bookType: 'xlsx' }))
      return { decidedAt }
    }
  }
  return null
}

export default function kycApiPlugin(): Plugin {
  return {
    name: 'kyc-api',
    configureServer(server) {
      server.middlewares.use('/api/records', (req, res) => {
        if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
        try {
          json(res, 200, readRecords())
        } catch (e) {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
      server.middlewares.use('/api/status', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
        try {
          const { id, status } = JSON.parse(await readBody(req)) as { id?: unknown; status?: unknown }
          if (typeof id !== 'number' || typeof status !== 'string' || !STATUSES.has(status)) {
            return json(res, 400, { error: 'Expected { id: number, status: FLAGGED|APPROVED|REJECTED }' })
          }
          const updated = updateStatus(id, status)
          if (!updated) return json(res, 404, { error: `No record with id ${id}` })
          json(res, 200, { id, status, decidedAt: updated.decidedAt?.toISOString() ?? null })
        } catch (e) {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
