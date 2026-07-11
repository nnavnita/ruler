/**
 * BYO-token storage.
 *
 * API keys never touch the Ruler backend. They live in localStorage and
 * are passed straight to the LLM provider from the browser. Reset with
 * `clearLlmConfig()`.
 */

export type LlmProvider = "anthropic" | "openai" | "openrouter";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

const KEY = "ruler.llm.config.v1";

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

export const PROVIDER_HOSTS: Record<LlmProvider, string> = {
  anthropic: "api.anthropic.com",
  openai: "api.openai.com",
  openrouter: "openrouter.ai",
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  openrouter: "OpenRouter (free + paid)",
};

export function loadLlmConfig(): LlmConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LlmConfig;
    if (!parsed.provider || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLlmConfig(config: LlmConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(config));
}

export function clearLlmConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
