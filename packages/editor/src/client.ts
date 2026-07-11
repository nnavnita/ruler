import type {
  AuditRecord,
  EvaluationResponse,
  JdmContent,
  ReplayEntry,
  RuleRecord,
  RuleTest,
  RuleTestResult,
  RuleVersion,
  StatusTransition,
} from "./types";

export interface RulerClient {
  // legacy rule surface
  listRules: () => Promise<RuleRecord[]>;
  getRule: (name: string) => Promise<RuleRecord>;
  saveRule: (name: string, content: JdmContent) => Promise<RuleRecord>;
  deleteRule: (name: string) => Promise<{ deleted: boolean }>;
  evaluate: (
    name: string,
    input: Record<string, unknown>,
    opts?: { version?: number },
  ) => Promise<EvaluationResponse>;

  // versions
  listVersions: (name: string) => Promise<RuleVersion[]>;
  getVersion: (name: string, version: number) => Promise<RuleVersion>;
  createDraft: (
    name: string,
    content: JdmContent,
    opts?: { author?: string; notes?: string },
  ) => Promise<RuleVersion>;
  transitionVersion: (
    name: string,
    version: number,
    action: StatusTransition,
    opts?: { reviewer?: string; comment?: string },
  ) => Promise<RuleVersion>;

  // replay
  replay: (
    name: string,
    version: number,
    inputs: Record<string, unknown>[],
  ) => Promise<ReplayEntry[]>;
  replayHistory: (
    name: string,
    version: number,
    opts?: { limit?: number },
  ) => Promise<ReplayEntry[]>;

  // tests
  listTests: (name: string) => Promise<RuleTest[]>;
  saveTest: (name: string, test: SaveTestPayload) => Promise<RuleTest>;
  deleteTest: (name: string, testId: string) => Promise<{ deleted: boolean }>;
  runTests: (
    name: string,
    opts?: { version?: number },
  ) => Promise<RuleTestResult[]>;

  // audit
  listLogs: (opts?: { limit?: number; ruleName?: string }) => Promise<AuditRecord[]>;
  getLog: (id: string) => Promise<AuditRecord>;
}

export interface SaveTestPayload {
  id?: string;
  name: string;
  input: Record<string, unknown>;
  expected: unknown;
  tags?: string[];
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
    evaluate: (name, input, opts) => {
      const qs = opts?.version !== undefined ? `?version=${opts.version}` : "";
      return request<EvaluationResponse>(
        `/api/rules/${encodeURIComponent(name)}/evaluate${qs}`,
        { method: "POST", body: JSON.stringify({ input }) },
      );
    },

    listVersions: (name) =>
      request<RuleVersion[]>(`/api/rules/${encodeURIComponent(name)}/versions`),
    getVersion: (name, version) =>
      request<RuleVersion>(
        `/api/rules/${encodeURIComponent(name)}/versions/${version}`,
      ),
    createDraft: (name, content, opts = {}) =>
      request<RuleVersion>(`/api/rules/${encodeURIComponent(name)}/versions`, {
        method: "POST",
        body: JSON.stringify({ content, ...opts }),
      }),
    transitionVersion: (name, version, action, opts = {}) =>
      request<RuleVersion>(
        `/api/rules/${encodeURIComponent(name)}/versions/${version}/transition`,
        { method: "POST", body: JSON.stringify({ action, ...opts }) },
      ),

    replay: (name, version, inputs) =>
      request<ReplayEntry[]>(
        `/api/rules/${encodeURIComponent(name)}/versions/${version}/replay`,
        { method: "POST", body: JSON.stringify({ inputs }) },
      ),
    replayHistory: (name, version, opts = {}) =>
      request<ReplayEntry[]>(
        `/api/rules/${encodeURIComponent(name)}/versions/${version}/replay-history`,
        { method: "POST", body: JSON.stringify({ limit: opts.limit ?? 50 }) },
      ),

    listTests: (name) =>
      request<RuleTest[]>(`/api/rules/${encodeURIComponent(name)}/tests`),
    saveTest: (name, test) =>
      request<RuleTest>(`/api/rules/${encodeURIComponent(name)}/tests`, {
        method: "POST",
        body: JSON.stringify(test),
      }),
    deleteTest: (name, testId) =>
      request<{ deleted: boolean }>(
        `/api/rules/${encodeURIComponent(name)}/tests/${encodeURIComponent(testId)}`,
        { method: "DELETE" },
      ),
    runTests: (name, opts = {}) =>
      request<RuleTestResult[]>(
        `/api/rules/${encodeURIComponent(name)}/tests/run`,
        {
          method: "POST",
          body: JSON.stringify({ version: opts.version ?? null }),
        },
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
