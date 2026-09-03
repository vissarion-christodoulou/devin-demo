export interface Order {
  id: number
  orderDate: Date
  product: string
  plan: string
  segment: string
  region: string
  channel: string
  seats: number
  billingPeriod: string
  orderAmount: number
  refunded: boolean
  refundReason: string | null
  refundAmount: number
  refundDate: Date | null
  daysToRefund: number | null
}

type SerializedOrder = Omit<Order, 'orderDate' | 'refundDate'> & {
  orderDate: string
  refundDate: string | null
}

export async function loadOrders(): Promise<Order[]> {
  const response = await fetch('/api/orders')
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Failed to load orders: ${response.status}`)
  }
  const orders = (await response.json()) as SerializedOrder[]
  return orders
    .map((order) => ({
      ...order,
      orderDate: new Date(order.orderDate),
      refundDate: order.refundDate ? new Date(order.refundDate) : null,
    }))
    .sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
}

export interface Slice {
  label: string
  value: number
}

export function sumBy(orders: Order[], key: (order: Order) => string, value: (order: Order) => number): Slice[] {
  const totals = new Map<string, number>()
  for (const order of orders) {
    const label = key(order)
    totals.set(label, (totals.get(label) ?? 0) + value(order))
  }
  return [...totals]
    .map(([label, total]) => ({ label, value: total }))
    .sort((a, b) => b.value - a.value)
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return currency.format(value)
}

const compactCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value)
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
