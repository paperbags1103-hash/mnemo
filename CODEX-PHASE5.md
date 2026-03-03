# mnemo Phase 5 — Hardening & Release Prep

Final polish, deployment configs, and production readiness.

## Task 1: GitHub repo setup files

Create `apps/backend/.github/` - no, create at root `.github/workflows/`:

### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/frontend/package-lock.json
      - run: npm ci --legacy-peer-deps
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: python -c "from app.main import app; print('import ok')"
```

## Task 2: Deployment configs

### `apps/frontend/vercel.json` (update/verify)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### `apps/backend/Dockerfile` (update for production)
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `apps/backend/fly.toml` (update)
```toml
app = "mnemo-backend"
primary_region = "nrt"

[build]

[env]
  PORT = "8000"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

## Task 3: README update

Update `README.md` at root with:
- Project description: "mnemo — AI Agent's Obsidian. Knowledge management web app powered by lorien."
- Architecture diagram (text)
- Quick start instructions:
  - Frontend: `cd apps/frontend && npm install --legacy-peer-deps && npm run dev`
  - Backend: `cd apps/backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --reload`
- Environment variables table
- Deploy instructions (Vercel + Fly.io)

## Task 4: Error boundaries in frontend

Add React error boundary to `apps/frontend/src/app/App.tsx`:
```tsx
import { Component, ErrorInfo, ReactNode } from 'react'

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center text-[#9b9b9b]">
          <div className="text-center">
            <p className="text-lg font-medium text-[#1a1a1a]">Something went wrong</p>
            <button onClick={() => this.setState({hasError: false})} className="mt-2 text-sm underline">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

Wrap the main app content with `<ErrorBoundary>`.

## Task 5: API error handling in frontend

In `apps/frontend/src/lib/api.ts`, improve error handling:
- Parse JSON error body when available, extract `.detail` field
- Add request timeout (10 seconds)
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000)
const response = await fetch(url, { ...options, signal: controller.signal })
clearTimeout(timeoutId)
```

## Task 6: docs/ folder

Create `docs/` folder with:
- `docs/architecture.md` — system diagram + data flow description
- `docs/api-contract.md` — copy the API contract from DEV-PLAN.md
- `docs/runbook.md` — how to restart services, check logs, common issues

## Task 7: Final verification + commit

1. `cd apps/frontend && npm run build` — must succeed, 0 TypeScript errors
2. `cd apps/backend && .venv/bin/python -c "from app.main import app; print('ok')"`
3. Check git log shows clean history
4. `git add -A && git commit -m "feat: Phase 5 — CI/CD, Dockerfile, README, error boundaries, docs"`

When done:
openclaw system event --text "Done: mnemo Phase 5 완료 — MVP release ready!" --mode now
