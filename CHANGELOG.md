# Changelog

All notable changes to this project will be documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and GitHub issue / PR templates for OSS hygiene.
- CI (`.github/workflows/ci.yml`) fanning out to `python`, `node`, `go`, and `java` jobs.
- CodeQL scanning (`.github/workflows/codeql.yml`) across all four languages.
- Weekly Dependabot bumps for GitHub Actions, npm, pip, gomod, and gradle.
- Tests: pytest suite for `ruler-python-sdk` (storage, versioning, evaluate, replay, harness), vitest suite for the `ruler-editor` HTTP client, httptest-backed unit tests for `ruler-go-sdk`.

### Changed
- Trace overlay in `ruler-editor`:
  - Hit nodes get an amber outline + drop-shadow, and their inner text is forced to a light palette in dark mode so headers and syntax-highlighted expression tokens stay readable.
  - Hit edges use reactflow's `animated` + per-edge style so paths + arrowheads paint amber.
  - Hit switch statement rows are tracked via MutationObserver and get a bright wash + left bar.
- Playground browser interpreter (`apps/marketing/src/lib/zen.ts`) emits per-node `traceData` matching `SimulationTraceData*` shapes in jdm-editor so all highlighting hooks in.

## [0.2.1] — 2026-07-11

Initial tagged release. See the [release notes](https://github.com/nnavnita/ruler/releases/tag/v0.2.1) for the full picture. Highlights:

- `ruler-python-sdk`, `ruler-editor`, `ruler-go-sdk`, `ruler-java-sdk` all wired end-to-end (compile checks only; nothing published to registries yet).
- Rule ops layer: version store, draft → review → publish flow, replay, deep-equal test harness.
- BYO-key LLM authoring (Anthropic, OpenAI, OpenRouter). Keys never leave the browser.
- Marketing site + in-browser playground at <https://nnavnita.github.io/ruler/> covering inputNode, expressionNode, switchNode, decisionTableNode, functionNode, and outputNode.
- Fullscreen graph view in the playground.

[Unreleased]: https://github.com/nnavnita/ruler/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/nnavnita/ruler/releases/tag/v0.2.1
