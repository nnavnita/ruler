export type JdmContent = Record<string, unknown>;

export interface RuleRecord {
  name: string;
  content: JdmContent;
  version: number;
  updated_at: string;
}

export interface AuditRecord {
  id: string;
  rule_name: string;
  rule_version: number;
  rule_snapshot: JdmContent;
  input: Record<string, unknown>;
  result: unknown;
  trace: Record<string, TraceNode> | null;
  performance: string | null;
  error: string | null;
  created_at: string;
}

export interface TraceNode {
  id?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  performance?: string;
  trace_data?: unknown;
  [k: string]: unknown;
}

export interface EvaluationResponse {
  result: unknown;
  trace: Record<string, TraceNode> | null;
  performance: string | null;
  rule_version: number;
}
