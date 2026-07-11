import { AiAuthorPanel, DecisionGraphEditor } from "ruler-editor";
import type { EvaluationResponse, JdmContent } from "ruler-editor";
import { useState } from "react";
import { evaluateJdm } from "./lib/zen";
import { starterGraph, starterInput } from "./lib/starterGraph";

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ms: string }
  | { kind: "err"; message: string };

export function Playground() {
  const [content, setContent] = useState<JdmContent>(starterGraph);
  const [inputText, setInputText] = useState<string>(starterInput);
  const [trace, setTrace] = useState<EvaluationResponse | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showAi, setShowAi] = useState(false);

  const handleEvaluate = async () => {
    setStatus({ kind: "running" });
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputText);
    } catch (exc) {
      setStatus({
        kind: "err",
        message: `Input is not valid JSON: ${exc instanceof Error ? exc.message : String(exc)}`,
      });
      return;
    }

    try {
      const response = await evaluateJdm(content, parsed);
      setTrace({
        result: response.result,
        trace: (response.trace as EvaluationResponse["trace"]) ?? null,
        performance: response.performance ?? null,
        rule_version: 0,
      });
      setStatus({ kind: "ok", ms: response.performance ?? "?" });
    } catch (exc) {
      setStatus({
        kind: "err",
        message: exc instanceof Error ? exc.message : String(exc),
      });
    }
  };

  const handleReset = () => {
    setContent(starterGraph);
    setInputText(starterInput);
    setTrace(null);
    setStatus({ kind: "idle" });
  };

  return (
    <section id="try" className="mt-16">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Try it</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Runs entirely in your browser. Bring your own Anthropic or OpenAI
            key to compose rules with AI — the key never leaves this tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <button
            onClick={() => setShowAi((v) => !v)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {showAi ? "Hide AI" : "Compose with AI"}
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset
          </button>
          <button
            onClick={handleEvaluate}
            disabled={status.kind === "running"}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {status.kind === "running" ? "Evaluating…" : "Evaluate"}
          </button>
        </div>
      </div>

      {showAi && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <AiAuthorPanel
            currentGraph={content}
            onApply={(next) => {
              setContent(next);
              setTrace(null);
              setStatus({ kind: "idle" });
            }}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <DecisionGraphEditor
            value={content}
            onChange={setContent}
            trace={trace}
          />
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              Input
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              spellCheck={false}
              rows={6}
              className="w-full resize-none rounded-b-xl bg-slate-950 p-3 font-mono text-xs text-slate-100"
            />
          </div>

          <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
              Result
            </div>
            <pre className="max-h-[380px] overflow-auto rounded-b-xl bg-slate-950 p-3 font-mono text-xs text-slate-100">
{status.kind === "err"
  ? `// error\n${status.message}`
  : trace
  ? JSON.stringify(trace.result, null, 2)
  : "// hit Evaluate to run"}
            </pre>
          </div>
        </aside>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "running")
    return (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Loading WASM…
      </span>
    );
  if (status.kind === "ok")
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
        {status.ms}
      </span>
    );
  return (
    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-200">
      Error
    </span>
  );
}
