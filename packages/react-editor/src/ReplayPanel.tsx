import { useState } from "react";
import type { RulerClient } from "./client";
import type { ReplayEntry } from "./types";

export interface ReplayPanelProps {
  client: RulerClient;
  ruleName: string;
  /** Version to replay against. */
  version: number;
  className?: string;
}

/**
 * Replay panel: pick "past inputs from history" or paste a JSON array,
 * evaluate each against the given rule version, show side-by-side results.
 *
 * Useful for what-if / regression checks: does my new draft still produce
 * the same decisions on real historical inputs?
 */
export function ReplayPanel(props: ReplayPanelProps) {
  const { client, ruleName, version, className } = props;
  const [source, setSource] = useState<"history" | "manual">("history");
  const [manual, setManual] = useState<string>(
    '[\n  {"tier":"gold","age":25},\n  {"tier":"silver","age":40},\n  {"tier":"none","age":70}\n]',
  );
  const [entries, setEntries] = useState<ReplayEntry[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      let result: ReplayEntry[];
      if (source === "history") {
        result = await client.replayHistory(ruleName, version, { limit: 50 });
      } else {
        const inputs = JSON.parse(manual);
        if (!Array.isArray(inputs)) throw new Error("Manual input must be a JSON array.");
        result = await client.replay(ruleName, version, inputs);
      }
      setEntries(result);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-slate-500">Inputs from</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as "history" | "manual")}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="history">audit history</option>
          <option value="manual">manual JSON</option>
        </select>
        <button
          onClick={run}
          disabled={running}
          className="ml-auto rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {running ? "Running…" : `Replay against v${version}`}
        </button>
      </div>

      {source === "manual" && (
        <textarea
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mb-3 w-full rounded-md bg-slate-950 p-2 font-mono text-xs text-slate-100"
        />
      )}

      {error && (
        <div className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {entries && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-500">
              <th className="px-2 py-1">Input</th>
              <th className="px-2 py-1">Result</th>
              <th className="px-2 py-1">Perf</th>
              <th className="px-2 py-1">Error</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b last:border-b-0 align-top">
                <td className="px-2 py-1 font-mono text-xs text-slate-600">
                  {truncate(JSON.stringify(e.input), 50)}
                </td>
                <td className="px-2 py-1 font-mono text-xs text-slate-800">
                  {truncate(JSON.stringify(e.result), 50)}
                </td>
                <td className="px-2 py-1 text-xs">{e.performance ?? "—"}</td>
                <td className="px-2 py-1 text-xs text-red-600">
                  {e.error ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
