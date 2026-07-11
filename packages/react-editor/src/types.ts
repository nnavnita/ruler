export type JdmContent = Record<string, unknown>;

export type RuleStatus = "draft" | "review" | "published" | "archived";

export interface RuleRecord {
  name: string;
  content: JdmContent;
  version: number;
  updated_at: string;
}

export interface RuleVersion {
  rule_name: string;
  version: number;
  content: JdmContent;
  status: RuleStatus;
  author: string | null;
  notes: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_decision: "approved" | "rejected" | null;
  review_comment: string | null;
  published_at: string | null;
}

export interface RuleTest {
  id: string;
  rule_name: string;
  name: string;
  input: Record<string, unknown>;
  expected: unknown;
  tags: string[];
  created_at: string;
}

export interface RuleTestResult {
  test_id: string;
  test_name: string;
  rule_name: string;
  rule_version: number;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  error: string | null;
  performance: string | null;
}

export interface ReplayEntry {
  input: Record<string, unknown>;
  result: unknown;
  trace: Record<string, TraceNode> | null;
  performance: string | null;
  error: string | null;
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

export type StatusTransition =
  | "submit"
  | "approve"
  | "reject"
  | "publish"
  | "archive";
