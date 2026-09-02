import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { read, utils, write } from 'xlsx'

const WORKBOOK_PATH = fileURLToPath(new URL('../KYC_review.xlsx', import.meta.url))
const STATUSES = new Set(['FLAGGED', 'APPROVED', 'REJECTED'])

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

function updateStatus(id: number, status: string): boolean {
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
  if (idCol === undefined || statusCol === undefined) return false
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const idCell = sheet[utils.encode_cell({ r, c: idCol })]
    if (idCell?.v === id) {
      sheet[utils.encode_cell({ r, c: statusCol })] = { t: 's', v: status }
      writeFileSync(WORKBOOK_PATH, write(workbook, { type: 'buffer', bookType: 'xlsx' }))
      return true
    }
  }
  return false
}

export default function kycApiPlugin(): Plugin {
  return {
    name: 'kyc-api',
    configureServer(server) {
      server.middlewares.use('/api/status', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
        try {
          const { id, status } = JSON.parse(await readBody(req)) as { id?: unknown; status?: unknown }
          if (typeof id !== 'number' || typeof status !== 'string' || !STATUSES.has(status)) {
            return json(res, 400, { error: 'Expected { id: number, status: FLAGGED|APPROVED|REJECTED }' })
          }
          if (!updateStatus(id, status)) return json(res, 404, { error: `No record with id ${id}` })
          json(res, 200, { id, status })
        } catch (e) {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
