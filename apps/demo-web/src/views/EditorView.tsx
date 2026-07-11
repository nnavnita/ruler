import { DecisionGraphEditor } from "@ruler/react-editor";
import type { EvaluationResponse, JdmContent } from "@ruler/react-editor";
import { useEffect, useState } from "react";
import { rulerClient } from "../lib/client";
import { starterGraph } from "../lib/starterGraph";

const DEFAULT_NAME = "demo";
const DEFAULT_INPUT = `{
  "age": 25,
  "tier": "gold"
}`;

export function EditorView() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [content, setContent] = useState<JdmContent>(starterGraph);
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [trace, setTrace] = useState<EvaluationResponse | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const record = await rulerClient.getRule(DEFAULT_NAME);
        setContent(record.content);
        setStatus(`Loaded '${record.name}' v${record.version}`);
      } catch {
        setStatus("No saved rule yet — starter graph shown");
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      const record = await rulerClient.saveRule(name, content);
      setStatus(`Saved v${record.version} at ${new Date(record.updated_at).toLocaleTimeString()}`);
    } catch (exc) {
      setStatus(`Save failed: ${exc instanceof Error ? exc.message : String(exc)}`);
    }
  };

  const handleEvaluate = async () => {
    try {
      const parsed = JSON.parse(inputText);
      const response = await rulerClient.evaluate(name, parsed);
      setTrace(response);
      setStatus(`Evaluated in ${response.performance ?? "?"}`);
    } catch (exc) {
      setStatus(`Evaluate failed: ${exc instanceof Error ? exc.message : String(exc)}`);
    }
  };

  return (
    <div className="grid h-full grid-cols-[1fr_360px]">
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <label className="text-xs text-slate-500">Rule name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            onClick={handleSave}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Save
          </button>
          <button
            onClick={handleEvaluate}
            className="rounded bg-amber-400 px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-300"
          >
            Evaluate
          </button>
          <span className="ml-auto text-xs text-slate-500">{status}</span>
        </div>

        <div className="flex-1">
          <DecisionGraphEditor value={content} onChange={setContent} trace={trace} />
        </div>
      </div>

      <aside className="flex flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Input context
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          spellCheck={false}
          className="h-56 resize-none border-b border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100"
        />

        <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Result
        </div>
        <pre className="flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs text-slate-100">
{trace ? JSON.stringify(trace.result, null, 2) : "// run Evaluate to see result"}
        </pre>
      </aside>
    </div>
  );
}
