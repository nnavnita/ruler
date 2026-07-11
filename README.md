# Ruler

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Latest release](https://img.shields.io/github/v/release/nnavnita/ruler?include_prereleases&sort=semver)](https://github.com/nnavnita/ruler/releases)
[![Pages deploy](https://github.com/nnavnita/ruler/actions/workflows/pages.yml/badge.svg)](https://github.com/nnavnita/ruler/actions/workflows/pages.yml)
[![Try the playground](https://img.shields.io/badge/playground-nnavnita.github.io%2Fruler-fbbf24)](https://nnavnita.github.io/ruler/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](./packages/python-sdk)
[![Node 18+](https://img.shields.io/badge/node-18%2B-339933.svg)](./packages/editor)
[![Go 1.22+](https://img.shields.io/badge/go-1.22%2B-00ADD8.svg)](./packages/go-sdk)
[![Java 17+](https://img.shields.io/badge/java-17%2B-ED8B00.svg)](./packages/java-sdk)

**Ruler is an opinionated BRMS stack around [GoRules Zen](https://github.com/gorules/zen) and [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor).** It takes the world-class Rust decision engine and visual editor GoRules ships open-source, and wraps them in the ops layer, test harness, replay, audit log, LLM authoring, and multi-language SDKs you would otherwise have to build yourself (or pay for the hosted GoRules BRMS to get).

Try the visual editor + in-browser evaluator: **<https://nnavnita.github.io/ruler/>**.

## What Ruler adds on top of GoRules

GoRules OSS gives you the Zen engine and the JDM graph editor. Ruler layers on the pieces you need to actually run rules in production:

| | Raw GoRules OSS | Ruler |
| --- | --- | --- |
| Decision-graph runtime | ✅ Zen (Rust) | ✅ same Zen, wrapped |
| Visual editor | ✅ `@gorules/jdm-editor` | ✅ same editor, plus trace overlay |
| Pluggable rule storage | ❌ | ✅ in-memory + file impls, protocol for anything else |
| Version history | ❌ | ✅ every save is an immutable `RuleVersion` |
| Draft → Review → Publish flow | ❌ | ✅ status transitions, reviewers, comments |
| Audit log of every evaluation | ❌ | ✅ pluggable sink, in-memory + JSONL out of the box |
| Replay past inputs against a candidate version | ❌ | ✅ what-if / regression built in |
| Declared test cases + pass/fail runs | ❌ | ✅ deep-equal harness, run against any version |
| Multi-language SDKs (Python / Go / Java / React) | ❌ | ✅ unified surface |
| BYO-key AI rule authoring (Claude / OpenAI / OpenRouter) | ❌ | ✅ direct browser → provider, key never proxied |
| Reference FastAPI backend + Vite React frontend | ❌ | ✅ fork or copy |
| Static marketing site + in-browser WASM playground | ❌ | ✅ GitHub Pages |

The GoRules commercial [BRMS SaaS](https://gorules.io/) covers some of this too. Ruler is an open, self-hostable, extensible alternative.

## Packages

- **`ruler-editor`** (npm) — React components. `<DecisionGraphEditor>`, `<VersionsPanel>`, `<TestsPanel>`, `<ReplayPanel>`, `<LogsViewer>`, `<AiAuthorPanel>`, plus a typed `createRulerClient(...)`.
- **`ruler-python-sdk`** (PyPI) — framework-agnostic Python engine + SDK. Pluggable rule store, version store, test store, and audit sink. Wraps `zen-engine`.
- **`ruler-go-sdk`** — zero-dep native Go HTTP client at `github.com/nnavnita/ruler/packages/go-sdk/ruler`.
- **`ruler-java-sdk`** — Java 17+ HTTP client (`io.ruler:ruler-java-sdk`, Jackson, `java.net.http`).
- **`demo-api`** — FastAPI reference service using `ruler-python-sdk`.
- **`demo-web`** — Vite + React reference client using `ruler-editor`.
- **`apps/marketing`** — static landing + playground for GitHub Pages.

## Consumers

- **Python backend:** `pip install ruler-python-sdk`, embed the engine. Storage / version / audit / test interfaces are pluggable — swap the in-memory impls for Postgres, S3, whatever.
- **Go backend:** `go get github.com/nnavnita/ruler/packages/go-sdk/ruler@v0.2.1`, talk to the reference service (or any compatible one) over HTTP.
- **Java backend:** grab `io.ruler:ruler-java-sdk`, same HTTP surface. Native JVM engine (JNI wrapper around zen-engine Rust core) is a future add.
- **React frontend:** `pnpm add ruler-editor`, drop the components wherever you need them.

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

## Publishing status

Nothing has been published to npm, PyPI, or Maven Central yet — the current tag is a milestone marker. See [releases](https://github.com/nnavnita/ruler/releases) for what's in each cut.

## Credits

Ruler stands on the shoulders of the excellent work at **[GoRules](https://gorules.io/)**:

- **[gorules/zen](https://github.com/gorules/zen)** — the ZEN Business Rules Engine. High-performance Rust core with Node, Python, Rust, and Go bindings. All rule evaluation in Ruler flows through Zen.
- **[gorules/jdm-editor](https://github.com/gorules/jdm-editor)** — the React JDM decision-graph editor. Ruler's `<DecisionGraphEditor>` is a thin wrapper that adds the ops UI, trace overlay, and typed API client on top.
- **[JDM spec](https://gorules.io/docs/rules-engine/decision-model)** — the JSON Decision Model that Ruler uses as its rule payload format.

Both libraries are MIT-licensed. Please star their repos.

## License

MIT — see [LICENSE](./LICENSE). See [NOTICE](./NOTICE) for third-party attributions.
