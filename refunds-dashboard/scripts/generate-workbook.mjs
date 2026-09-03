// Regenerates data/Refunds.xlsx, the system of record for the dashboard.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { utils, write } from 'xlsx'

const WORKBOOK_PATH = fileURLToPath(new URL('../data/Refunds.xlsx', import.meta.url))

const PRODUCTS = [
  { name: 'Payments API', plans: ['Starter', 'Growth', 'Scale'], mrr: [149, 499, 1490], weight: 26 },
  { name: 'Invoicing Suite', plans: ['Starter', 'Growth', 'Scale'], mrr: [59, 199, 599], weight: 20 },
  { name: 'Expense Cards', plans: ['Team', 'Business', 'Enterprise'], mrr: [99, 349, 1200], weight: 16 },
  { name: 'Payroll Automation', plans: ['Starter', 'Growth', 'Scale'], mrr: [129, 429, 1290], weight: 12 },
  { name: 'Fraud Shield', plans: ['Essentials', 'Advanced', 'Enterprise'], mrr: [199, 749, 2400], weight: 10 },
  { name: 'Ledger Sync', plans: ['Starter', 'Growth'], mrr: [79, 259], weight: 9 },
  { name: 'Business Banking Pro', plans: ['Business', 'Enterprise'], mrr: [89, 890], weight: 7 },
]

const REGIONS = [
  { name: 'North America', weight: 40 },
  { name: 'Europe', weight: 31 },
  { name: 'LATAM', weight: 12 },
  { name: 'APAC', weight: 12 },
  { name: 'Middle East', weight: 5 },
]

const SEGMENTS = [
  { name: 'Solo', weight: 22 },
  { name: 'SMB', weight: 46 },
  { name: 'Mid-Market', weight: 24 },
  { name: 'Enterprise', weight: 8 },
]

const CHANNELS = [
  { name: 'Self-serve', weight: 55 },
  { name: 'Sales-led', weight: 25 },
  { name: 'Partner', weight: 12 },
  { name: 'Marketplace', weight: 8 },
]

// Refund reasons with the relative likelihood of each once a refund happens.
const REASONS = [
  { name: 'Duplicate charge', weight: 22 },
  { name: 'Failed integration', weight: 18 },
  { name: 'Downgrade credit', weight: 16 },
  { name: 'Billing error', weight: 14 },
  { name: 'Service outage', weight: 12 },
  { name: 'Fraudulent charge', weight: 10 },
  { name: 'Churn within trial', weight: 8 },
]

// Baseline probability a given order ends up refunded, per product.
const REFUND_RATE = {
  'Payments API': 0.09,
  'Invoicing Suite': 0.06,
  'Expense Cards': 0.13,
  'Payroll Automation': 0.11,
  'Fraud Shield': 0.05,
  'Ledger Sync': 0.16,
  'Business Banking Pro': 0.08,
}

// Deterministic PRNG so regenerating the workbook does not churn the data.
let seed = 20260215
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

function pick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = random() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function pickIndex(length) {
  return Math.min(length - 1, Math.floor(random() * length))
}

function round2(value) {
  return Math.round(value * 100) / 100
}

const START = Date.UTC(2025, 8, 1)
const END = Date.UTC(2026, 2, 1)
const ROWS = 900

const rows = []
for (let i = 0; i < ROWS; i++) {
  const product = pick(PRODUCTS)
  const planIndex = pickIndex(product.plans.length)
  const region = pick(REGIONS).name
  const segment = pick(SEGMENTS).name
  const channel = pick(CHANNELS).name
  const orderDate = new Date(START + random() * (END - START))
  const seats = 1 + Math.floor(random() * (segment === 'Enterprise' ? 40 : segment === 'Mid-Market' ? 12 : 4))
  const months = random() < 0.28 ? 12 : 1
  const amount = round2(product.mrr[planIndex] * seats * months * (months === 12 ? 0.85 : 1))

  const refundLift = (channel === 'Marketplace' ? 0.04 : 0) + (segment === 'Solo' ? 0.03 : 0)
  const refunded = random() < REFUND_RATE[product.name] + refundLift
  let reason = ''
  let refundAmount = 0
  let refundDate = undefined
  let daysToRefund = undefined
  if (refunded) {
    reason = pick(REASONS).name
    // Large contracts are settled with a pro-rated credit rather than a full reversal.
    const partial = amount > 20000 || reason === 'Downgrade credit' || reason === 'Service outage'
    refundAmount = round2(partial ? amount * (0.1 + random() * 0.4) : amount)
    daysToRefund = 1 + Math.floor(random() * (reason === 'Duplicate charge' ? 5 : 45))
    refundDate = new Date(orderDate.getTime() + daysToRefund * 86400000)
  }

  rows.push({
    id: 1000 + i,
    'Order Date': orderDate,
    Product: product.name,
    Plan: product.plans[planIndex],
    'Customer Segment': segment,
    Region: region,
    Channel: channel,
    Seats: seats,
    'Billing Period': months === 12 ? 'Annual' : 'Monthly',
    'Order Amount': amount,
    Refunded: refunded ? 'Yes' : 'No',
    'Refund Reason': reason,
    'Refund Amount': refundAmount,
    'Refund Date': refundDate,
    'Days To Refund': daysToRefund,
  })
}

rows.sort((a, b) => a['Order Date'].getTime() - b['Order Date'].getTime())
rows.forEach((row, index) => (row.id = 1000 + index))

const sheet = utils.json_to_sheet(rows, { cellDates: true })
sheet['!cols'] = Object.keys(rows[0]).map((header) => ({ wch: Math.max(12, header.length + 2) }))
const workbook = utils.book_new()
utils.book_append_sheet(workbook, sheet, 'Orders')
writeFileSync(WORKBOOK_PATH, write(workbook, { type: 'buffer', bookType: 'xlsx' }))

const refunds = rows.filter((row) => row.Refunded === 'Yes')
console.log(`Wrote ${rows.length} orders (${refunds.length} refunded) to ${WORKBOOK_PATH}`)
