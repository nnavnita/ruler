import { useEffect, useState } from "react";
import type { JdmContent } from "./types";
import {
  DEFAULT_MODELS,
  clearLlmConfig,
  loadLlmConfig,
  saveLlmConfig,
  type LlmConfig,
  type LlmProvider,
} from "./lib/keyStorage";
import { authorRule } from "./lib/llm";

export interface AiAuthorPanelProps {
  /** Current graph, passed to the model as context. */
  currentGraph: JdmContent | null;
  /** Called with the generated graph when the user clicks Apply. */
  onApply: (next: JdmContent) => void;
  className?: string;
}

/**
 * BYO-key rule-authoring panel. The user's API key stays in localStorage
 * and is used only for direct browser -> provider calls. The Ruler
 * backend never sees the key.
 */
export function AiAuthorPanel(props: AiAuthorPanelProps) {
  const { currentGraph, onApply, className } = props;

  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [request, setRequest] = useState<string>(
    "Give me a discount rule: 20% if tier is 'gold', 10% if 'silver', 5% if age >= 60, else 0.",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ content: JdmContent; raw: string } | null>(null);

  useEffect(() => {
    setConfig(loadLlmConfig());
  }, []);

  const generate = async () => {
    if (!config) {
      setShowConfig(true);
      return;
    }
    setPending(true);
    setError(null);
    setPreview(null);
    try {
      const result = await authorRule(config, request, currentGraph);
      setPreview(result);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setPending(false);
    }
  };

  const apply = () => {
    if (!preview) return;
    onApply(preview.content);
    setPreview(null);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Author with AI</div>
        <div className="flex items-center gap-2">
          {config ? (
            <span className="text-xs text-slate-500">
              {config.provider} · {config.model}
            </span>
          ) : (
            <span className="text-xs text-amber-700">No key configured</span>
          )}
          <button
            onClick={() => setShowConfig(true)}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
          >
            Config
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        Your API key stays in this browser. Requests go straight to the provider —
        Ruler&rsquo;s backend never sees the key.
      </p>

      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={4}
        spellCheck={false}
        className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        placeholder="Describe the rule you want…"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={generate}
          disabled={pending || !request.trim()}
          className="rounded bg-amber-400 px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
        {preview && (
          <button
            onClick={apply}
            className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
          >
            Apply to editor
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview ({preview.content.nodes ? (preview.content.nodes as unknown[]).length : "?"} nodes)
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
            {JSON.stringify(preview.content, null, 2)}
          </pre>
        </div>
      )}

      {showConfig && (
        <ConfigModal
          initial={config}
          onClose={() => setShowConfig(false)}
          onSave={(c) => {
            saveLlmConfig(c);
            setConfig(c);
            setShowConfig(false);
          }}
          onClear={() => {
            clearLlmConfig();
            setConfig(null);
            setShowConfig(false);
          }}
        />
      )}
    </div>
  );
}

function ConfigModal(props: {
  initial: LlmConfig | null;
  onClose: () => void;
  onSave: (config: LlmConfig) => void;
  onClear: () => void;
}) {
  const [provider, setProvider] = useState<LlmProvider>(props.initial?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(props.initial?.apiKey ?? "");
  const [model, setModel] = useState(
    props.initial?.model ?? DEFAULT_MODELS[props.initial?.provider ?? "anthropic"],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="w-96 rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-lg font-semibold">LLM config</div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Provider
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as LlmProvider;
              setProvider(p);
              setModel(DEFAULT_MODELS[p]);
            }}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </label>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Model
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </label>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </label>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Stored in <code>localStorage</code>. Never uploaded, never proxied.
          Requests go directly to <code>{provider === "anthropic" ? "api.anthropic.com" : "api.openai.com"}</code>.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => apiKey && props.onSave({ provider, apiKey, model })}
            disabled={!apiKey}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={props.onClear}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            Clear
          </button>
          <button
            onClick={props.onClose}
            className="ml-auto text-sm text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
