import { Playground } from "./Playground";

export function App() {
  return (
    <main className="mx-auto max-w-5xl px-6 pt-16 pb-24">
      <Hero />
      <Ctas />
      <Playground />
      <Features />
      <PythonSnippet />
      <ReactSnippet />
      <Architecture />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <header className="mb-6 flex items-center gap-5">
      <img src="/ruler/favicon.svg" alt="" className="h-14 w-14" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ruler</h1>
        <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">
          Visual rule-engine studio. Draw JDM decision graphs, evaluate them,
          watch executed nodes light up, keep an audit trail. GoRules Zen under
          the hood.
        </p>
      </div>
    </header>
  );
}

function Ctas() {
  return (
    <div className="mb-8 flex flex-wrap gap-3">
      <a
        href="#try"
        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-300"
      >
        Try it now
      </a>
      <a
        href="https://github.com/nnavnita/ruler"
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        View on GitHub
      </a>
    </div>
  );
}

function Features() {
  const cards = [
    {
      pill: "PY",
      pillTone: "amber",
      name: "ruler-engine",
      body: "Framework-agnostic Python library wrapping GoRules Zen. Pluggable storage + audit sinks. FastAPI, Flask, Lambda, or a script.",
      code: "pip install ruler-engine",
    },
    {
      pill: "TS",
      pillTone: "sky",
      name: "@ruler/react-editor",
      body: "React components for the visual editor, trace overlay, and audit-log table. Typed HTTP client included. Peer deps: React 18+.",
      code: "pnpm add @ruler/react-editor",
    },
    {
      pill: "API",
      pillTone: "emerald",
      name: "reference service",
      body: "FastAPI service that wires the Python engine to a small HTTP surface. Java, Go, and other backends consume it as plain JSON.",
      code: "uvicorn demo_api.main:app",
    },
    {
      pill: "WEB",
      pillTone: "violet",
      name: "reference client",
      body: "Vite + React demo app showing the editor, trace overlay, and log viewer wired end-to-end. Fork it, or copy the bits you want.",
      code: "pnpm --filter demo-web dev",
    },
  ];

  return (
    <section className="mt-16">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">What&rsquo;s in the box</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.name}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className={pillClass(c.pillTone)}>{c.pill}</span>
              <code className="font-mono text-sm text-slate-800 dark:text-slate-100">
                {c.name}
              </code>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{c.body}</p>
            <pre className="rounded-md bg-slate-950 p-2 font-mono text-xs text-slate-100">
              {c.code}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function pillClass(tone: string) {
  const base = "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider";
  switch (tone) {
    case "amber":
      return `${base} bg-amber-100 text-amber-900`;
    case "sky":
      return `${base} bg-sky-100 text-sky-900`;
    case "emerald":
      return `${base} bg-emerald-100 text-emerald-900`;
    case "violet":
      return `${base} bg-violet-100 text-violet-900`;
    default:
      return `${base} bg-slate-100 text-slate-800`;
  }
}

function PythonSnippet() {
  return (
    <section className="mt-16">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Python, minimal</h2>
      <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-sm text-slate-100 shadow-sm">
{`from ruler_engine import RuleEngine, InMemoryStorage, InMemoryAuditSink

engine = RuleEngine(
    storage=InMemoryStorage(),
    audit=InMemoryAuditSink(),
)

engine.save_rule("discount", jdm_json_dict)

outcome = engine.evaluate("discount", {"age": 25, "tier": "gold"})
print(outcome.result)        # -> {"discount": 0.20}
print(outcome.performance)   # -> "312µs"
print(outcome.trace)         # -> dict of executed node outputs`}
      </pre>
    </section>
  );
}

function ReactSnippet() {
  return (
    <section className="mt-16">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">React, minimal</h2>
      <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-sm text-slate-100 shadow-sm">
{`import {
  DecisionGraphEditor,
  LogsViewer,
  createRulerClient,
} from "@ruler/react-editor";

const client = createRulerClient({ baseUrl: "https://api.example.com" });

export function App() {
  const [content, setContent] = useState(myJdm);
  const [trace, setTrace] = useState(null);
  return (
    <>
      <DecisionGraphEditor value={content} onChange={setContent} trace={trace} />
      <LogsViewer client={client} />
    </>
  );
}`}
      </pre>
    </section>
  );
}

function Architecture() {
  return (
    <section className="mt-16">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Architecture</h2>
      <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 shadow-sm">
{`┌─────────────────────┐    ┌─────────────────────┐
│  React frontend     │    │  Java / Python /    │
│  @ruler/react-editor│    │  anything backend   │
└──────────┬──────────┘    └──────────┬──────────┘
           │  HTTP + JSON             │  pip install
           ▼                          ▼  ruler-engine
┌─────────────────────────────────────────────────┐
│  FastAPI reference service (demo-api)           │
│  · rules · evaluate · trace · audit log         │
└──────────────────────┬──────────────────────────┘
                       │  embeds
                       ▼
┌─────────────────────────────────────────────────┐
│  ruler-engine  →  GoRules Zen (Rust core)       │
└─────────────────────────────────────────────────┘`}
      </pre>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 flex items-center justify-between border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
      <span>
        Ruler &middot; MIT &middot; built by{" "}
        <a href="https://nnavnita.com" className="underline hover:text-slate-800 dark:hover:text-slate-200">
          nnavnita
        </a>
      </span>
      <a
        href="https://github.com/nnavnita/ruler"
        className="underline hover:text-slate-800 dark:hover:text-slate-200"
      >
        GitHub
      </a>
    </footer>
  );
}
