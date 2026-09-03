# Feature Flags Admin

Toggles one feature flag per main graph of the refunds dashboard. State is persisted in
`data/flags.json` by a small FastAPI backend; the frontend is only the switches.

## Backend (port 8000)

```sh
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8000
```

- `GET /api/flags` → `[{ key, label, description, enabled }]`
- `GET /api/flags/stream` → server-sent events: the full flag list on connect and after every
  toggle, so subscribers update without polling or a reload
- `PUT /api/flags/{key}` with `{ "enabled": bool }`

Unknown or missing keys in the file default to enabled, so the dashboard fails open.

## Frontend (port 5175)

Requires Node 22 (`nvm use`). Proxies `/api` to the backend (override with `FLAGS_API_URL`).

```sh
cd frontend
npm install
npm run dev
```

The refunds dashboard subscribes to the same stream and shows/hides graphs live as flags change.
