import { useCallback, useEffect, useState } from "react";
import type { RulerClient } from "./client";
import type { RuleTest, RuleTestResult } from "./types";

export interface TestsPanelProps {
  client: RulerClient;
  ruleName: string;
  /** Run against a specific version instead of the current published one. */
  version?: number;
  className?: string;
}

/**
 * Declared test cases for a rule: list, add, delete, and run.
 * A test = (input JSON, expected JSON). Deep-equal comparison decides pass/fail.
 */
export function TestsPanel(props: TestsPanelProps) {
  const { client, ruleName, version, className } = props;
  const [tests, setTests] = useState<RuleTest[]>([]);
  const [results, setResults] = useState<Record<string, RuleTestResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [newName, setNewName] = useState("");
  const [newInput, setNewInput] = useState('{"tier":"gold","age":25}');
  const [newExpected, setNewExpected] = useState('{"discount":0.20}');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTests(await client.listTests(ruleName));
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }, [client, ruleName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAll = async () => {
    setRunning(true);
    try {
      const rs = await client.runTests(ruleName, { version });
      const byId: Record<string, RuleTestResult> = {};
      for (const r of rs) byId[r.test_id] = r;
      setResults(byId);
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setRunning(false);
    }
  };

  const add = async () => {
    setSaving(true);
    try {
      const input = JSON.parse(newInput);
      const expected = JSON.parse(newExpected);
      await client.saveTest(ruleName, { name: newName || "unnamed", input, expected });
      setNewName("");
      await refresh();
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (test: RuleTest) => {
    try {
      await client.deleteTest(ruleName, test.id);
      await refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  };

  const passed = Object.values(results).filter((r) => r.passed).length;
  const total = Object.values(results).length;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          {total > 0 && (
            <>
              {passed}/{total} passing
            </>
          )}
        </div>
        <button
          onClick={runAll}
          disabled={running || tests.length === 0}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {running ? "Running…" : "Run all"}
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-slate-500">
            <th className="px-2 py-1">Test</th>
            <th className="px-2 py-1">Input</th>
            <th className="px-2 py-1">Expected</th>
            <th className="px-2 py-1">Actual</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => {
            const r = results[t.id];
            return (
              <tr key={t.id} className="border-b last:border-b-0 align-top">
                <td className="px-2 py-1 font-medium">{t.name}</td>
                <td className="px-2 py-1 font-mono text-xs text-slate-600">
                  {truncate(JSON.stringify(t.input), 40)}
                </td>
                <td className="px-2 py-1 font-mono text-xs text-slate-600">
                  {truncate(JSON.stringify(t.expected), 40)}
                </td>
                <td className="px-2 py-1 font-mono text-xs text-slate-600">
                  {r ? truncate(JSON.stringify(r.actual), 40) : "—"}
                </td>
                <td className="px-2 py-1">
                  {r ? (
                    r.passed ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        PASS
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800"
                        title={r.error ?? ""}
                      >
                        FAIL
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <button
                    onClick={() => remove(t)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add test
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            placeholder="name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            placeholder="input JSON"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          />
          <input
            placeholder="expected JSON"
            value={newExpected}
            onChange={(e) => setNewExpected(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          />
          <button
            onClick={add}
            disabled={saving}
            className="rounded bg-amber-400 px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {saving ? "…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
