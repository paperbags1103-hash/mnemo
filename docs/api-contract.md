# API Contract

Base URL: `/api/v1`

## Notes

### `POST /notes`
- Purpose: create a note
- Request

```json
{
  "title": "string",
  "content": "string",
  "folder_id": "uuid|null"
}
```

- Response `201`

```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "folder_id": "uuid|null",
  "created_at": "iso",
  "updated_at": "iso",
  "version": 1
}
```

- Side effect: ingest job enqueue (`async`)

### `GET /notes/{note_id}`
- Response `200`: note detail

### `PATCH /notes/{note_id}`
- Purpose: partial update for auto-save
- Header: `If-Match: <version>` (recommended)
- Request

```json
{
  "title": "string?",
  "content": "string?",
  "folder_id": "uuid|null?"
}
```

- Response `200`: updated note
- Conflict: `409` for version mismatch
- Side effect: ingest job enqueue (`async`)

### `DELETE /notes/{note_id}`
- Response `204`
- Side effect: optional de-index or delete request to lorien queue

### `GET /notes?folder_id=&q=&cursor=&limit=`
- Purpose: note list and search
- Response `200`

```json
{
  "items": [],
  "next_cursor": "string|null"
}
```

## Tree / Folder

### `GET /tree`
- Purpose: render the left file tree
- Response: folder and note hierarchy

### `POST /folders`

### `PATCH /folders/{folder_id}`

### `DELETE /folders/{folder_id}`

## Search

### `GET /search?q=...&limit=...`
- MVP: Turso text search
- v1.1+: optional hybrid search

## Ingest Observability

### `GET /ingest/jobs?status=&limit=`
- Purpose: ops and debugging

### `POST /ingest/jobs/{job_id}/retry`
- Purpose: manual retry

## Health

### `GET /health/live`

### `GET /health/ready`
- `ready` includes `turso` and `lorien` dependency status as non-blocking detail

## Lorien Wrapper Endpoints

### `POST /lorien/ingest/note`
- Purpose: note to lorien graph ingest

```json
{
  "note_id": "uuid",
  "title": "string",
  "content": "string",
  "updated_at": "iso",
  "source": "mnemo"
}
```

- Response `202`

```json
{
  "accepted": true,
  "trace_id": "string"
}
```

### `POST /lorien/ingest/batch`
- Purpose: backlog reprocessing

### `GET /lorien/graph`
- Compatible with `lorien serve` plus wrapper normalization

### `GET /lorien/notes/{note_id}/entities`

### `GET /lorien/notes/{note_id}/facts`

### `GET /lorien/contradictions?note_id=`

### `GET /lorien/epistemic-debt?note_id=`

### `GET /lorien/search?query=&top_k=`

### `GET /lorien/health`
- Wrapper health plus lorien dependency state

### `GET /lorien/metrics`
- Ingest latency, failure count, and queue depth
