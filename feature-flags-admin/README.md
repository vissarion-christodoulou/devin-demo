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
- `PUT /api/flags/{key}` with `{ "enabled": bool }`

Unknown or missing keys in the file default to enabled, so the dashboard fails open.

## Frontend (port 5175)

Requires Node 22 (`nvm use`). Proxies `/api` to the backend (override with `FLAGS_API_URL`).

```sh
cd frontend
npm install
npm run dev
```

The refunds dashboard reads the same `GET /api/flags` endpoint and hides any graph whose flag is
off, so run the backend before `refunds-dashboard`.
