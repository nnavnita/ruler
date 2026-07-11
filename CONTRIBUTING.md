# Contributing to Ruler

Thanks for wanting to contribute. Ruler is an opinionated wrapper around [GoRules Zen](https://github.com/gorules/zen) — please star their repos too.

## TL;DR

- Fork, branch off `main`, commit, PR against `main`.
- Keep changes narrow. One concern per PR.
- Green CI is required. `pnpm --filter ruler-editor test`, `uv run pytest`, and `go test ./...` all need to pass.

## Repo layout

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

## Local dev

Prereqs: Node 20+, pnpm 9+, Python 3.10+, uv, Go 1.22+, Java 17+ (only if touching the Java SDK), Gradle.

```bash
# One-time install
pnpm install
uv sync

# Run demo (two terminals)
pnpm dev:api    # FastAPI on :8000
pnpm dev:web    # Vite on :5173
```

### Language-specific loops

- **Python** — `uv run --package ruler-python-sdk pytest packages/python-sdk/tests -v` and `uv run --package ruler-python-sdk ruff check packages/python-sdk`.
- **React / TS** — `pnpm --filter ruler-editor build`, `pnpm --filter ruler-editor test`, `pnpm --filter demo-web dev`.
- **Go** — `cd packages/go-sdk && go test -race ./...`.
- **Java** — `cd packages/java-sdk && gradle build`.

## Style / conventions

- **Python** — ruff with the project rules (E, F, W, I, B, UP). Line length 100. Type hints on public APIs. Small, focused functions.
- **TypeScript** — strict mode. No `any` except at typing boundaries. Explicit exports from `src/index.ts`.
- **Go** — `go vet` clean, standard formatting (`gofmt`).
- **Java** — records for models, `java.net.http` for HTTP.
- **Commit messages** — conventional, short subject lines, body wrapped at 72 chars. Reference the issue when relevant.

## Adding a new node kind

The playground browser interpreter lives at `apps/marketing/src/lib/zen.ts`. Adding a node kind means:

1. Handling it in the `switch (node.type)` inside `walk()`.
2. Emitting `traceData` that matches `SimulationTraceData*` in `@gorules/jdm-editor` (so highlighting works).
3. Extending the Python engine at `packages/python-sdk/src/ruler/engine.py` to fan out to the underlying zen-engine, if needed.
4. A regression test in `packages/python-sdk/tests` using a small demo rule.

## Reporting bugs

Use the bug-report issue template. Include:

- Package + version (e.g. `ruler-python-sdk 0.2.1`, or `commit hash` if from `main`).
- A minimal JDM graph that reproduces.
- Actual vs expected output.
- Trace or stack trace if you have one.

## Security disclosures

See [`SECURITY.md`](./SECURITY.md). **Do not** open a public issue for security bugs.
