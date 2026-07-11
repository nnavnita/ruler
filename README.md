# Ruler

Rule engine with visual editor, live trace overlay, and audit history. GoRules JDM (Zen Engine) under the hood.

Monorepo ships:

- **`@ruler/react-editor`** — React/TS component library. Wraps `@gorules/jdm-editor`, adds trace overlay, log viewer, and typed HTTP client. Drop into any React app.
- **`ruler-engine`** (Python, `pip install ruler-engine`) — thin lib around `zen-engine`. Pluggable storage + audit sinks. Framework-agnostic.
- **`demo-api`** — FastAPI service using `ruler-engine`. Reference backend.
- **`demo-web`** — Vite React app using `@ruler/react-editor`. Reference frontend.

## Consumers

- **Python backend:** `pip install ruler-engine`, embed. Storage/audit interfaces are pluggable — swap in-memory for Postgres, log to S3, etc.
- **Java backend:** call `demo-api` over HTTP. (Native JVM lib possible via zen-engine's JNI binding — deferred until asked.)
- **React frontend:** `pnpm add @ruler/react-editor`, drop `<DecisionGraphEditor />` and `<LogsViewer />` into your app.

## Layout

```
packages/
  react-editor/    # @ruler/react-editor (npm)
  python-engine/   # ruler-engine (pip)
apps/
  demo-api/        # FastAPI reference server
  demo-web/        # Vite React reference client
```

## Dev

```bash
# One-time
pnpm install
uv sync

# Run demo (two terminals)
pnpm dev:api    # FastAPI on :8000
pnpm dev:web    # Vite on :5173
```

## Build libs for publish

```bash
pnpm build                          # builds react-editor
uv build --package ruler-engine     # sdist + wheel for python-engine
```
