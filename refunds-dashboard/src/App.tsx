import { useEffect, useMemo, useState } from 'react'
import { BarChart, HorizontalBarChart, LineChart, PieChart } from './charts'
import { ALL_ENABLED, loadFlags, type FlagState } from './featureFlags'
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  loadOrders,
  monthKey,
  monthLabel,
  sumBy,
  type Order,
} from './refunds'

const ALL = 'All'

export default function App() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState(ALL)
  const [segment, setSegment] = useState(ALL)
  const [flags, setFlags] = useState<FlagState>(ALL_ENABLED)

  useEffect(() => {
    loadOrders().then(setOrders, (e: Error) => setError(e.message))
    loadFlags().then(setFlags, () => setFlags(ALL_ENABLED))
  }, [])

  const regions = useMemo(() => [ALL, ...new Set(orders.map((o) => o.region))].sort(), [orders])
  const segments = useMemo(() => [ALL, ...new Set(orders.map((o) => o.segment))].sort(), [orders])

  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          (region === ALL || order.region === region) && (segment === ALL || order.segment === segment),
      ),
    [orders, region, segment],
  )

  const stats = useMemo(() => summarize(visible), [visible])

  if (error) return <p className="error">{error}</p>
  if (orders.length === 0) return <p className="placeholder">Loading refunds workbook…</p>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Refunds Dashboard</h1>
          <p className="subtitle">
            {visible.length.toLocaleString()} orders from <code>data/Refunds.xlsx</code>
          </p>
        </div>
        <div className="filters">
          <label>
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Segment
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {segments.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="kpis">
        <Kpi label="Gross revenue" value={formatCurrency(stats.gross)} />
        <Kpi label="Refunded" value={formatCurrency(stats.refundedAmount)} tone="bad" />
        <Kpi label="Net revenue" value={formatCurrency(stats.gross - stats.refundedAmount)} tone="good" />
        <Kpi label="Refund rate" value={formatPercent(stats.refundRate)} />
        <Kpi label="Refunded orders" value={stats.refundCount.toLocaleString()} />
        <Kpi label="Avg days to refund" value={`${stats.avgDaysToRefund.toFixed(1)} d`} />
      </section>

      <section className="grid">
        {flags.refundedValueByReason && (
          <Card title="Refunded value by reason" hint="Share of refunded dollars">
            <PieChart slices={stats.byReason} format={formatCurrency} />
          </Card>
        )}
        {flags.refundRateByProduct && (
          <Card title="Refund rate by product" hint="Refunded value ÷ gross value">
            <BarChart slices={stats.rateByProduct} format={formatPercent} />
          </Card>
        )}
        {flags.monthlyGrossVsRefunded && (
          <Card title="Monthly gross vs refunded" hint="Order date, USD">
            <LineChart series={stats.monthly} format={formatCurrency} formatAxis={formatCompactCurrency} />
          </Card>
        )}
        {flags.refundedValueByRegion && (
          <Card title="Refunded value by region" hint="Across all products">
            <HorizontalBarChart slices={stats.byRegion} format={formatCurrency} />
          </Card>
        )}
        {flags.refundedValueByProduct && (
          <Card title="Refunded value by product" hint="Top SaaS lines">
            <BarChart slices={stats.byProduct} format={formatCompactCurrency} color="#a855f7" />
          </Card>
        )}
        {flags.refundRateByChannel && (
          <Card title="Refund rate by channel" hint="Acquisition channel">
            <HorizontalBarChart slices={stats.rateByChannel} format={formatPercent} color="#f59e0b" />
          </Card>
        )}
      </section>
      {Object.values(flags).every((enabled) => !enabled) && (
        <p className="placeholder">All graphs are turned off in feature-flags-admin.</p>
      )}

      <section className="card table-card">
        <h2>Product breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Orders</th>
              <th>Gross</th>
              <th>Refunded</th>
              <th>Refund rate</th>
              <th>Top reason</th>
            </tr>
          </thead>
          <tbody>
            {stats.productRows.map((row) => (
              <tr key={row.product}>
                <td>{row.product}</td>
                <td>{row.orders.toLocaleString()}</td>
                <td>{formatCurrency(row.gross)}</td>
                <td>{formatCurrency(row.refunded)}</td>
                <td>{formatPercent(row.rate)}</td>
                <td>{row.topReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={tone ? `kpi-value ${tone}` : 'kpi-value'}>{value}</span>
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      {children}
    </section>
  )
}

function summarize(orders: Order[]) {
  const refunds = orders.filter((order) => order.refunded)
  const gross = orders.reduce((sum, order) => sum + order.orderAmount, 0)
  const refundedAmount = refunds.reduce((sum, order) => sum + order.refundAmount, 0)

  const grossByProduct = new Map(sumBy(orders, (o) => o.product, (o) => o.orderAmount).map((s) => [s.label, s.value]))
  const byProduct = sumBy(refunds, (o) => o.product, (o) => o.refundAmount)
  const rateByProduct = byProduct
    .map((slice) => ({ label: slice.label, value: slice.value / (grossByProduct.get(slice.label) || 1) }))
    .sort((a, b) => b.value - a.value)

  const grossByChannel = new Map(sumBy(orders, (o) => o.channel, (o) => o.orderAmount).map((s) => [s.label, s.value]))
  const rateByChannel = sumBy(refunds, (o) => o.channel, (o) => o.refundAmount)
    .map((slice) => ({ label: slice.label, value: slice.value / (grossByChannel.get(slice.label) || 1) }))
    .sort((a, b) => b.value - a.value)

  const months = [...new Set(orders.map((order) => monthKey(order.orderDate)))].sort()
  const monthly = months.map((key) => ({
    label: monthLabel(key),
    orders: orders
      .filter((order) => monthKey(order.orderDate) === key)
      .reduce((sum, order) => sum + order.orderAmount, 0),
    refunded: refunds
      .filter((order) => monthKey(order.orderDate) === key)
      .reduce((sum, order) => sum + order.refundAmount, 0),
  }))

  const productRows = [...grossByProduct.keys()]
    .map((product) => {
      const productRefunds = refunds.filter((order) => order.product === product)
      const refunded = productRefunds.reduce((sum, order) => sum + order.refundAmount, 0)
      const productGross = grossByProduct.get(product) ?? 0
      const topReason = sumBy(productRefunds, (o) => o.refundReason ?? 'Unknown', () => 1)[0]?.label ?? '—'
      return {
        product,
        orders: orders.filter((order) => order.product === product).length,
        gross: productGross,
        refunded,
        rate: productGross === 0 ? 0 : refunded / productGross,
        topReason,
      }
    })
    .sort((a, b) => b.refunded - a.refunded)

  return {
    gross,
    refundedAmount,
    refundCount: refunds.length,
    refundRate: gross === 0 ? 0 : refundedAmount / gross,
    avgDaysToRefund:
      refunds.length === 0
        ? 0
        : refunds.reduce((sum, order) => sum + (order.daysToRefund ?? 0), 0) / refunds.length,
    byReason: sumBy(refunds, (o) => o.refundReason ?? 'Unknown', (o) => o.refundAmount),
    byProduct,
    rateByProduct,
    rateByChannel,
    byRegion: sumBy(refunds, (o) => o.region, (o) => o.refundAmount),
    monthly,
    productRows,
  }
}
