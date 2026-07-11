# Ruler

Rule engine with visual editor, live trace overlay, versioned rule ops (draft → review → publish), replay, and a test harness. GoRules JDM (Zen Engine) under the hood; opinionated ops layer on top.

Monorepo ships:

- **`ruler-editor`** — React/TS component library. Wraps `@gorules/jdm-editor`; adds trace overlay, log viewer, versions panel, tests panel, replay panel, AI author panel, and a typed HTTP client.
- **`ruler-python-sdk`** (`pip install ruler-python-sdk`) — framework-agnostic Python rule engine + SDK. Pluggable rule storage, version store, test store, and audit sink. Wraps `zen-engine`.
- **`ruler-go-sdk`** — Go HTTP client. Import path `github.com/nnavnita/ruler/packages/go-sdk/ruler`.
- **`ruler-java-sdk`** — Java 17+ HTTP client (`io.ruler:ruler-java-sdk`, Jackson).
- **`demo-api`** — FastAPI reference service using `ruler-python-sdk`.
- **`demo-web`** — Vite React reference client using `ruler-editor`.

## Consumers

- **Python backend:** `pip install ruler-python-sdk`, embed. Storage / version / audit / test interfaces are pluggable — swap in-memory for Postgres, log to S3, etc.
- **Go backend:** `go get github.com/nnavnita/ruler/packages/go-sdk/ruler`, talk to the reference service (or any compatible one) over HTTP.
- **Java backend:** grab `io.ruler:ruler-java-sdk`, same HTTP surface. Native JVM engine (JNI wrapper around zen-engine Rust core) is a future add.
- **React frontend:** `pnpm add ruler-editor`, drop `<DecisionGraphEditor />`, `<VersionsPanel />`, `<TestsPanel />`, `<LogsViewer />`, `<AiAuthorPanel />` wherever you need them.

## Layout

```
packages/
  editor/          # ruler-editor (npm)
  python-sdk/      # ruler-python-sdk (pip)
  go-sdk/          # ruler-go-sdk
  java-sdk/        # ruler-java-sdk
apps/
  demo-api/        # FastAPI reference server
  demo-web/        # Vite React reference client
  marketing/       # nnavnita.github.io/ruler landing + playground
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
pnpm --filter ruler-editor build          # tsup ESM + CJS
uv build --package ruler-python-sdk       # sdist + wheel
cd packages/go-sdk && go build ./...      # sanity check Go SDK
cd packages/java-sdk && gradle build      # jar + sources + javadoc
```
