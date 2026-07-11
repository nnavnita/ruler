import { AiAuthorPanel, DecisionGraphEditor } from "@ruler/react-editor";
import type { EvaluationResponse, JdmContent } from "@ruler/react-editor";
import { useEffect, useState } from "react";
import { rulerClient } from "../lib/client";
import { starterGraph } from "../lib/starterGraph";

const DEFAULT_INPUT = `{
  "age": 25,
  "tier": "gold"
}`;

export function EditorView({ ruleName }: { ruleName: string }) {
  const [content, setContent] = useState<JdmContent>(starterGraph);
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [trace, setTrace] = useState<EvaluationResponse | null>(null);
  const [status, setStatus] = useState<string>("");
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const record = await rulerClient.getRule(ruleName);
        setContent(record.content);
        setStatus(`Loaded '${record.name}' v${record.version}`);
      } catch {
        setStatus("No saved rule yet — starter graph shown");
      }
    })();
  }, [ruleName]);

  const handleSave = async () => {
    try {
      const version = await rulerClient.createDraft(ruleName, content);
      setStatus(`Saved draft v${version.version}`);
    } catch (exc) {
      setStatus(`Save failed: ${exc instanceof Error ? exc.message : String(exc)}`);
    }
  };

  const handleEvaluate = async () => {
    try {
      const parsed = JSON.parse(inputText);
      const response = await rulerClient.evaluate(ruleName, parsed);
      setTrace(response);
      setStatus(`Evaluated v${response.rule_version} in ${response.performance ?? "?"}`);
    } catch (exc) {
      setStatus(`Evaluate failed: ${exc instanceof Error ? exc.message : String(exc)}`);
    }
  };

  return (
    <div className="grid h-full grid-cols-[1fr_380px]">
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <button
            onClick={handleSave}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Save draft
          </button>
          <button
            onClick={handleEvaluate}
            className="rounded bg-amber-400 px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-300"
          >
            Evaluate
          </button>
          <button
            onClick={() => setShowAi((v) => !v)}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            {showAi ? "Hide AI" : "Author with AI"}
          </button>
          <span className="ml-auto text-xs text-slate-500">{status}</span>
        </div>

        <div className="flex-1">
          <DecisionGraphEditor value={content} onChange={setContent} trace={trace} />
        </div>
      </div>

      <aside className="flex flex-col overflow-auto border-l border-slate-200 bg-white">
        {showAi && (
          <div className="border-b border-slate-200 p-4">
            <AiAuthorPanel
              currentGraph={content}
              onApply={(next) => {
                setContent(next);
                setStatus("Applied AI-generated graph — save draft to persist");
              }}
            />
          </div>
        )}

        <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Input context
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          spellCheck={false}
          className="h-40 resize-none border-b border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100"
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
