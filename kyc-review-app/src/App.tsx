import { useEffect, useState } from 'react'
import { loadKycRecords, type KycRecord } from './kyc'

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export default function App() {
  const [records, setRecords] = useState<KycRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    loadKycRecords().then(setRecords, (e: Error) => setError(e.message))
  }, [])

  const selected = records.find((r) => r.id === selectedId) ?? null

  return (
    <div className="layout">
      <aside className="list">
        <h1>KYC Review Queue</h1>
        {error && <p className="error">{error}</p>}
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              <button
                className={record.id === selectedId ? 'row selected' : 'row'}
                onClick={() => setSelectedId(record.id)}
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
        {selected ? (
          <Detail record={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <p className="placeholder">Select a row to see its details.</p>
        )}
      </main>
    </div>
  )
}

function Detail({ record, onClose }: { record: KycRecord; onClose: () => void }) {
  const fields: [string, string | number][] = [
    ['ID', record.id],
    ['Customer Name', record.customerName],
    ['Name Read From Id', record.nameReadFromId],
    ['Credit Score', record.creditScore ?? '—'],
    ['Sanctions from data source 1', record.sanctionsSource1],
    ['Sanctions from data source 2', record.sanctionsSource2],
    ['Status', record.status],
    ['Reason', record.reason],
    ['Entered Queue', timestampFormat.format(record.enteredQueue)],
  ]
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
    </>
  )
}
