import { PALETTE } from './palette'
import type { Slice } from './refunds'

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const rawStep = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude * 10
  const ticks: number[] = []
  for (let tick = 0; tick <= max + step / 2; tick += step) ticks.push(tick)
  return ticks
}

function polar(cx: number, cy: number, radius: number, fraction: number): [number, number] {
  const angle = 2 * Math.PI * fraction - Math.PI / 2
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
}

export function PieChart({
  slices,
  format,
}: {
  slices: Slice[]
  format: (value: number) => string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return <p className="empty">No data for the current filters.</p>

  const arcs = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / total
    const fraction = slice.value / total
    const end = start + fraction
    const [x1, y1] = polar(110, 110, 100, start)
    const [x2, y2] = polar(110, 110, 100, end)
    const [ix2, iy2] = polar(110, 110, 52, end)
    const [ix1, iy1] = polar(110, 110, 52, start)
    const largeArc = fraction > 0.5 ? 1 : 0
    const path = [
      `M ${x1} ${y1}`,
      `A 100 100 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A 52 52 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ')
    return { ...slice, path, fraction, color: PALETTE[index % PALETTE.length] }
  })

  return (
    <div className="pie">
      <svg viewBox="0 0 220 220" role="img" aria-label="Share by category">
        {arcs.map((arc) => (
          <path key={arc.label} d={arc.path} fill={arc.color} stroke="#fff" strokeWidth="1.5">
            <title>{`${arc.label}: ${format(arc.value)} (${(arc.fraction * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        <text className="pie-total" x="110" y="104" textAnchor="middle">
          {format(total)}
        </text>
        <text className="pie-caption" x="110" y="124" textAnchor="middle">
          total
        </text>
      </svg>
      <ul className="legend">
        {arcs.map((arc) => (
          <li key={arc.label}>
            <span className="swatch" style={{ background: arc.color }} />
            <span className="legend-label">{arc.label}</span>
            <span className="legend-value">
              {format(arc.value)} · {(arc.fraction * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BarChart({
  slices,
  format,
  formatAxis = format,
  color = PALETTE[0],
}: {
  slices: Slice[]
  format: (value: number) => string
  formatAxis?: (value: number) => string
  color?: string
}) {
  if (slices.length === 0) return <p className="empty">No data for the current filters.</p>
  const width = 520
  const height = 260
  const padding = { top: 16, right: 12, bottom: 52, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const ticks = niceTicks(Math.max(...slices.map((s) => s.value)))
  const max = ticks[ticks.length - 1]
  const band = plotWidth / slices.length
  const barWidth = Math.min(56, band * 0.62)

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      {ticks.map((tick) => {
        const y = padding.top + plotHeight - (tick / max) * plotHeight
        return (
          <g key={tick}>
            <line className="grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
            <text className="axis" x={padding.left - 8} y={y + 4} textAnchor="end">
              {formatAxis(tick)}
            </text>
          </g>
        )
      })}
      {slices.map((slice, index) => {
        const barHeight = (slice.value / max) * plotHeight
        const x = padding.left + band * index + (band - barWidth) / 2
        const y = padding.top + plotHeight - barHeight
        return (
          <g key={slice.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={color}>
              <title>{`${slice.label}: ${format(slice.value)}`}</title>
            </rect>
            <text className="axis value" x={x + barWidth / 2} y={y - 6} textAnchor="middle">
              {format(slice.value)}
            </text>
            <text
              className="axis"
              x={padding.left + band * index + band / 2}
              y={height - padding.bottom + 18}
              textAnchor="end"
              transform={`rotate(-28 ${padding.left + band * index + band / 2} ${height - padding.bottom + 18})`}
            >
              {slice.label}
            </text>
          </g>
        )
      })}
      <line
        className="axis-line"
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + plotHeight}
        y2={padding.top + plotHeight}
      />
    </svg>
  )
}

export function HorizontalBarChart({
  slices,
  format,
  color = PALETTE[2],
}: {
  slices: Slice[]
  format: (value: number) => string
  color?: string
}) {
  if (slices.length === 0) return <p className="empty">No data for the current filters.</p>
  const max = Math.max(...slices.map((s) => s.value)) || 1
  return (
    <ul className="hbars">
      {slices.map((slice) => (
        <li key={slice.label}>
          <span className="hbar-label">{slice.label}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: `${Math.max(2, (slice.value / max) * 100)}%`, background: color }}
            />
          </span>
          <span className="hbar-value">{format(slice.value)}</span>
        </li>
      ))}
    </ul>
  )
}

export function LineChart({
  series,
  format,
  formatAxis = format,
}: {
  series: { label: string; refunded: number; orders: number }[]
  format: (value: number) => string
  formatAxis?: (value: number) => string
}) {
  if (series.length === 0) return <p className="empty">No data for the current filters.</p>
  const width = 520
  const height = 260
  const padding = { top: 16, right: 12, bottom: 40, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const ticks = niceTicks(Math.max(...series.flatMap((p) => [p.refunded, p.orders])))
  const max = ticks[ticks.length - 1]
  const x = (index: number) =>
    padding.left + (series.length === 1 ? plotWidth / 2 : (plotWidth * index) / (series.length - 1))
  const y = (value: number) => padding.top + plotHeight - (value / max) * plotHeight
  const line = (key: 'refunded' | 'orders') =>
    series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key])}`).join(' ')

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly trend">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis" x={padding.left - 8} y={y(tick) + 4} textAnchor="end">
              {formatAxis(tick)}
            </text>
          </g>
        ))}
        <path d={line('orders')} fill="none" stroke={PALETTE[1]} strokeWidth="2.5" />
        <path d={line('refunded')} fill="none" stroke={PALETTE[4]} strokeWidth="2.5" />
        {series.map((point, index) => (
          <g key={point.label}>
            <circle cx={x(index)} cy={y(point.orders)} r="3.5" fill={PALETTE[1]}>
              <title>{`${point.label} gross: ${format(point.orders)}`}</title>
            </circle>
            <circle cx={x(index)} cy={y(point.refunded)} r="3.5" fill={PALETTE[4]}>
              <title>{`${point.label} refunded: ${format(point.refunded)}`}</title>
            </circle>
            <text className="axis" x={x(index)} y={height - padding.bottom + 20} textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <ul className="legend inline">
        <li>
          <span className="swatch" style={{ background: PALETTE[1] }} />
          <span className="legend-label">Gross revenue</span>
        </li>
        <li>
          <span className="swatch" style={{ background: PALETTE[4] }} />
          <span className="legend-label">Refunded</span>
        </li>
      </ul>
    </>
  )
}
