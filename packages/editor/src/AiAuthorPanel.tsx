import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { JdmContent } from "./types";
import {
  DEFAULT_MODELS,
  PROVIDER_HOSTS,
  PROVIDER_LABELS,
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

const PROVIDERS: LlmProvider[] = ["anthropic", "openai", "openrouter"];

/**
 * BYO-key rule-authoring panel. The user's API key stays in localStorage
 * and is used only for direct browser -> provider calls. The Ruler
 * backend never sees the key.
 *
 * Respects `prefers-color-scheme: dark` via Tailwind `dark:` variants.
 * The config modal is portalled to `document.body` so it escapes any
 * ancestor stacking context (reactflow etc.) and correctly overlays.
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
    <div
      className={
        "rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 " +
        (className ?? "")
      }
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Author with AI
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Your API key stays in this browser. Requests go direct to the provider — Ruler&rsquo;s backend never sees it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {config ? (
            <span
              className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              title={`${config.provider} · ${config.model}`}
            >
              {config.provider}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              No key
            </span>
          )}
          <button
            onClick={() => setShowConfig(true)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Config
          </button>
        </div>
      </div>

      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="Describe the rule you want…"
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-500"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={generate}
          disabled={pending || !request.trim()}
          className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
        {preview && (
          <button
            onClick={apply}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Apply to editor
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
  const [provider, setProvider] = useState<LlmProvider>(
    props.initial?.provider ?? "anthropic",
  );
  const [apiKey, setApiKey] = useState(props.initial?.apiKey ?? "");
  const [model, setModel] = useState(
    props.initial?.model ?? DEFAULT_MODELS[props.initial?.provider ?? "anthropic"],
  );
  const [reveal, setReveal] = useState(false);

  const placeholder =
    provider === "anthropic"
      ? "sk-ant-…"
      : provider === "openrouter"
      ? "sk-or-…"
      : "sk-…";

  const helpUrl =
    provider === "anthropic"
      ? "https://console.anthropic.com/settings/keys"
      : provider === "openrouter"
      ? "https://openrouter.ai/keys"
      : "https://platform.openai.com/api-keys";

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            LLM config
          </div>
          <button
            onClick={props.onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field label="Provider">
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as LlmProvider;
                setProvider(p);
                setModel(DEFAULT_MODELS[p]);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            {provider === "openrouter" && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Free-tier models like{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                  meta-llama/llama-3.3-70b-instruct:free
                </code>{" "}
                work out of the box.
              </p>
            )}
          </Field>

          <Field label="Model">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </Field>

          <Field label="API key">
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-16 font-mono text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-1.5 top-1.5 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Grab one from{" "}
              <a
                href={helpUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-slate-700 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                {new URL(helpUrl).host}
              </a>
              .
            </p>
          </Field>

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Stored in{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
              localStorage
            </code>
            . Never uploaded, never proxied. Requests go direct to{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
              {PROVIDER_HOSTS[provider]}
            </code>
            .
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
          <button
            onClick={props.onClear}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            onClick={props.onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => apiKey && props.onSave({ provider, apiKey, model })}
            disabled={!apiKey}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}
