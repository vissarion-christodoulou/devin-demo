import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { read, utils } from 'xlsx'

const WORKBOOK_PATH = fileURLToPath(new URL('./data/Refunds.xlsx', import.meta.url))

interface RawRow {
  id: number
  'Order Date': Date
  Product: string
  Plan: string
  'Customer Segment': string
  Region: string
  Channel: string
  Seats: number
  'Billing Period': string
  'Order Amount': number
  Refunded: string
  'Refund Reason'?: string
  'Refund Amount'?: number
  'Refund Date'?: Date
  'Days To Refund'?: number
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readOrders() {
  const workbook = read(readFileSync(WORKBOOK_PATH), { cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return utils.sheet_to_json<RawRow>(sheet).map((row) => ({
    id: row.id,
    orderDate: row['Order Date'].toISOString(),
    product: row.Product,
    plan: row.Plan,
    segment: row['Customer Segment'],
    region: row.Region,
    channel: row.Channel,
    seats: row.Seats,
    billingPeriod: row['Billing Period'],
    orderAmount: row['Order Amount'],
    refunded: row.Refunded === 'Yes',
    refundReason: row['Refund Reason'] || null,
    refundAmount: row['Refund Amount'] ?? 0,
    refundDate: row['Refund Date'] instanceof Date ? row['Refund Date'].toISOString() : null,
    daysToRefund: typeof row['Days To Refund'] === 'number' ? row['Days To Refund'] : null,
  }))
}

export default function refundsApiPlugin(): Plugin {
  return {
    name: 'refunds-api',
    configureServer(server) {
      server.middlewares.use('/api/orders', (req, res) => {
        if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
        try {
          json(res, 200, readOrders())
        } catch (e) {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}
