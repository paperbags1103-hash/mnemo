# Runbook

## Restart Services

### Frontend

```bash
cd apps/frontend
npm run dev
```

For Vercel production, trigger a redeploy from the Vercel dashboard after updating environment variables or frontend assets.

### Backend

```bash
cd apps/backend
.venv/bin/uvicorn app.main:app --reload
```

For Fly.io production, deploy a new release with `fly deploy` from `apps/backend`.

## Check Logs

### Frontend
- Local: inspect the terminal running Vite and the browser developer console.
- Vercel: open the deployment log and function log views for the affected deployment.

### Backend
- Local: inspect the terminal running Uvicorn.
- Fly.io: run `fly logs` from `apps/backend` and check health checks, startup output, and request failures.

## Common Issues

### Frontend cannot reach backend
- Verify `VITE_API_URL` points to the correct backend origin.
- Confirm CORS settings in `apps/backend/app/core/config.py` allow the frontend origin.
- Check whether the backend is healthy at `/health/live` and `/health/ready`.

### Backend import or startup failure
- Reinstall dependencies with `.venv/bin/pip install -r requirements.txt`.
- Confirm required env vars are set for Turso or allow SQLite fallback for local development.
- Run `.venv/bin/python -c "from app.main import app; print('ok')"` to verify importability.

### Note saves work but graph features fail
- Inspect lorien configuration and filesystem access for `LORIEN_DB_PATH`.
- Review ingest job endpoints for stuck or failed jobs.
- Treat lorien outages as non-blocking for note CRUD while backlog catches up after recovery.

### Fly.io deployment health check failures
- Confirm the container listens on port `8000`.
- Verify `PORT=8000` is present in Fly env config.
- Check recent release logs for dependency install or import failures.
