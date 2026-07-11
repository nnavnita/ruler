import type {
  AuditRecord,
  EvaluationResponse,
  JdmContent,
  RuleRecord,
} from "./types";

export interface RulerClient {
  listRules: () => Promise<RuleRecord[]>;
  getRule: (name: string) => Promise<RuleRecord>;
  saveRule: (name: string, content: JdmContent) => Promise<RuleRecord>;
  deleteRule: (name: string) => Promise<{ deleted: boolean }>;
  evaluate: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<EvaluationResponse>;
  listLogs: (opts?: { limit?: number; ruleName?: string }) => Promise<AuditRecord[]>;
  getLog: (id: string) => Promise<AuditRecord>;
}

export interface CreateRulerClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export function createRulerClient(options: CreateRulerClientOptions): RulerClient {
  const { baseUrl, fetchImpl = fetch, headers = {} } = options;
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new RulerApiError(response.status, text || response.statusText, path);
    }
    return response.json() as Promise<T>;
  }

  return {
    listRules: () => request<RuleRecord[]>("/api/rules"),
    getRule: (name) => request<RuleRecord>(`/api/rules/${encodeURIComponent(name)}`),
    saveRule: (name, content) =>
      request<RuleRecord>(`/api/rules/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    deleteRule: (name) =>
      request<{ deleted: boolean }>(`/api/rules/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
    evaluate: (name, input) =>
      request<EvaluationResponse>(
        `/api/rules/${encodeURIComponent(name)}/evaluate`,
        { method: "POST", body: JSON.stringify({ input }) },
      ),
    listLogs: (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.limit !== undefined) params.set("limit", String(opts.limit));
      if (opts.ruleName) params.set("rule_name", opts.ruleName);
      const qs = params.toString();
      return request<AuditRecord[]>(`/api/logs${qs ? `?${qs}` : ""}`);
    },
    getLog: (id) => request<AuditRecord>(`/api/logs/${encodeURIComponent(id)}`),
  };
}

export class RulerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`Ruler API ${status} on ${path}: ${body}`);
    this.name = "RulerApiError";
  }
}
