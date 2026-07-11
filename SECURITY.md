# Security policy

## Supported versions

Ruler is pre-1.0. Only the latest tagged release (see [releases](https://github.com/nnavnita/ruler/releases)) is supported.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs.

Use GitHub's private [security advisory reporting](https://github.com/nnavnita/ruler/security/advisories/new) to submit a report. Include:

- The affected package (e.g. `ruler-python-sdk`, `ruler-editor`, `ruler-go-sdk`, `ruler-java-sdk`, or one of the reference apps).
- Version / commit hash.
- Steps to reproduce, including a minimal JDM graph or input if applicable.
- Impact assessment: data-loss, remote code execution, DoS, etc.

I aim to acknowledge reports within 72 hours and to publish a fix or mitigation within 30 days of confirmation. Coordinated disclosure is welcome.

## Threat model notes

Because Ruler executes user-authored rules, a few things are worth calling out explicitly:

- **`functionNode` executes arbitrary code.** In the browser playground it uses `new AsyncFunction(...)`; in the FastAPI backend it delegates to `zen-engine`. Never load a JDM graph you don't trust.
- **LLM authoring (BYOK)** stores API keys in `localStorage` and sends requests directly to the provider host. The Ruler backend never sees the key. If you're worried about key leakage, use a browser profile scoped to the tab.
- **Marketing site** is fully static; the playground evaluates rules in-browser via `@gorules/zen-engine-wasm`. Nothing leaves your device.

## Dependency reports

Ruler runs [GitHub CodeQL](https://github.com/nnavnita/ruler/actions/workflows/codeql.yml) and [Dependabot](.github/dependabot.yml) on all languages in the repo. Security advisories for third-party dependencies show up in the repo's Security tab.
