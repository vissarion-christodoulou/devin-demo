import { useEffect, useState } from 'react'
import {
  hourlyQueueSize,
  loadKycRecords,
  QUEUE_HISTORY_HOURS,
  updateKycStatus,
  type HourlyQueueSize,
  type KycRecord,
  type KycStatus,
} from './kyc'

const STATUSES: readonly KycStatus[] = ['FLAGGED', 'APPROVED', 'REJECTED']

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

const LABEL_EVERY_HOURS = 6

export default function App() {
  const [records, setRecords] = useState<KycRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<KycStatus>('FLAGGED')
  const [showGraph, setShowGraph] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    loadKycRecords().then(setRecords, (e: Error) => setError(e.message))
  }, [])

  const selected = records.find((r) => r.id === selectedId) ?? null
  const decide = async (id: number, status: KycStatus) => {
    setSaving(true)
    setSaveError(null)
    try {
      const decidedAt = await updateKycStatus(id, status)
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status, decidedAt } : r)))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }
  const query = search.trim().toLowerCase()
  const visible = records.filter(
    (r) =>
      (query === '' || r.customerName.toLowerCase().includes(query)) &&
      r.status === statusFilter,
  )

  return (
    <div className="layout">
      <aside className="list">
        <header className="list-header">
          <h1>KYC Review Queue</h1>
          <button className="graph-toggle" onClick={() => setShowGraph((shown) => !shown)}>
            {showGraph ? 'Hide queue size' : 'See queue size'}
          </button>
        </header>
        <div className="controls">
          <input
            type="search"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as KycStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="error">{error}</p>}
        {!error && records.length > 0 && visible.length === 0 && (
          <p className="placeholder empty">No matching records.</p>
        )}
        <ul>
          {visible.map((record) => (
            <li key={record.id}>
              <button
                className={record.id === selectedId ? 'row selected' : 'row'}
                onClick={() => {
                  setSelectedId(record.id)
                  setShowGraph(false)
                }}
              >
                <span className="title">
                  <span className="name">{record.customerName}</span>
                  <time className="entered" dateTime={record.enteredQueue.toISOString()}>
                    {timestampFormat.format(record.enteredQueue)}
                  </time>
                </span>
                <span className="reason">{record.reason}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="detail">
        {showGraph ? (
          <QueueSize records={records} />
        ) : selected ? (
          <Detail
            record={selected}
            onClose={() => setSelectedId(null)}
            onDecide={(status) => decide(selected.id, status)}
            saving={saving}
            saveError={saveError}
          />
        ) : (
          <p className="placeholder">Select a row to see its details.</p>
        )}
      </main>
    </div>
  )
}

function QueueSize({ records }: { records: KycRecord[] }) {
  const buckets = hourlyQueueSize(records)
  const peak = Math.max(...buckets.map((bucket) => bucket.size), 1)
  return (
    <section className="queue-size">
      <h2>Queue size by hour</h2>
      <p className="placeholder">
        Cases still awaiting a decision, over the past {QUEUE_HISTORY_HOURS} hours.
      </p>
      <ol className="bars">
        {buckets.map((bucket, index) => (
          <Bar
            key={bucket.hour.toISOString()}
            bucket={bucket}
            peak={peak}
            labelled={(buckets.length - 1 - index) % LABEL_EVERY_HOURS === 0}
          />
        ))}
      </ol>
    </section>
  )
}

function Bar({
  bucket,
  peak,
  labelled,
}: {
  bucket: HourlyQueueSize
  peak: number
  labelled: boolean
}) {
  return (
    <li title={`${timestampFormat.format(bucket.hour)}: ${bucket.size} flagged`}>
      <span className="bar-track">
        <span className="bar-fill" style={{ height: `${(bucket.size / peak) * 100}%` }} />
      </span>
      <time className="bar-label" dateTime={bucket.hour.toISOString()}>
        {labelled ? hourFormat.format(bucket.hour) : ''}
      </time>
    </li>
  )
}

function Detail({
  record,
  onClose,
  onDecide,
  saving,
  saveError,
}: {
  record: KycRecord
  onClose: () => void
  onDecide: (status: KycStatus) => void
  saving: boolean
  saveError: string | null
}) {
  const fields: [string, string | number][] = [
    ['ID', record.id],
    ['Customer Name', record.customerName],
    ['Name Read From Id', record.nameReadFromId],
    ['Credit Score', record.creditScore ?? '—'],
    ['Sanctions from data source 1', record.sanctionsSource1],
    ['Sanctions from data source 2', record.sanctionsSource2],
    ['Status', record.status],
    ['Reason', record.reason],
  ]
  if (record.decidedAt) fields.push(['Decided At', timestampFormat.format(record.decidedAt)])
  return (
    <>
      <header>
        <h2>
          {record.customerName}
          <time className="entered" dateTime={record.enteredQueue.toISOString()}>
            Entered queue {timestampFormat.format(record.enteredQueue)}
          </time>
        </h2>
        <button className="close" onClick={onClose}>
          Close
        </button>
      </header>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {record.status === 'FLAGGED' && (
        <footer className="actions">
          <button className="approve" disabled={saving} onClick={() => onDecide('APPROVED')}>
            Approve
          </button>
          <button className="reject" disabled={saving} onClick={() => onDecide('REJECTED')}>
            Reject
          </button>
          {saveError && <span className="error">{saveError}</span>}
        </footer>
      )}
    </>
  )
}
