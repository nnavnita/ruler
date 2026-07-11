# Ruler

Rule engine with visual editor, live trace overlay, versioned rule ops (draft → review → publish), replay, and a test harness. GoRules JDM (Zen Engine) under the hood; opinionated ops layer on top.

Monorepo ships:

- **`@ruler/react-editor`** — React/TS component library. Wraps `@gorules/jdm-editor`; adds trace overlay, log viewer, versions panel, tests panel, replay panel, and a typed HTTP client.
- **`ruler-engine`** (Python, `pip install ruler-engine`) — framework-agnostic rule engine. Pluggable rule storage, version store, test store, and audit sink. Wraps `zen-engine`.
- **`demo-api`** — FastAPI reference service using `ruler-engine`.
- **`demo-web`** — Vite React reference client using `@ruler/react-editor`.
- **`packages/go-sdk`** — Go HTTP client (`github.com/nnavnita/ruler/packages/go-sdk/ruler`).
- **`packages/java-sdk`** — Java 17+ HTTP client (`io.ruler:client`, Jackson).

## Consumers

- **Python backend:** `pip install ruler-engine`, embed. Storage / version / audit / test interfaces are pluggable — swap in-memory for Postgres, log to S3, etc.
- **Go backend:** `go get github.com/nnavnita/ruler/packages/go-sdk/ruler`, talk to the reference service (or any compatible one) over HTTP.
- **Java backend:** grab `io.ruler:client`, same HTTP surface. Native JVM engine (JNI wrapper around zen-engine Rust core) is a future add.
- **React frontend:** `pnpm add @ruler/react-editor`, drop `<DecisionGraphEditor />`, `<VersionsPanel />`, `<TestsPanel />`, `<LogsViewer />` wherever you need them.

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
