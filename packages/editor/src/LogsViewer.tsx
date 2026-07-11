import { useEffect, useState } from "react";
import type { RulerClient } from "./client";
import type { AuditRecord } from "./types";

export interface LogsViewerProps {
  client: RulerClient;
  /** Filter logs to a specific rule. */
  ruleName?: string;
  /** Called when a row is clicked — hand back the full audit record. */
  onSelect?: (record: AuditRecord) => void;
  limit?: number;
  className?: string;
  /** Auto-refresh interval in ms. Disabled by default. */
  refreshMs?: number;
}

/**
 * Simple audit-log table. Unstyled — bring your own CSS. Rows are clickable
 * so you can drive a trace overlay on your editor.
 */
export function LogsViewer(props: LogsViewerProps) {
  const { client, ruleName, onSelect, limit = 100, className, refreshMs } = props;
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const rows = await client.listLogs({ limit, ruleName });
        if (!cancelled) {
          setRecords(rows);
          setError(null);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = refreshMs ? window.setInterval(load, refreshMs) : undefined;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [client, ruleName, limit, refreshMs]);

  return (
    <div className={className}>
      {error && <div role="alert">Error: {error}</div>}
      {loading && records.length === 0 && <div>Loading…</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cell}>Time</th>
            <th style={cell}>Rule</th>
            <th style={cell}>v</th>
            <th style={cell}>Result</th>
            <th style={cell}>Perf</th>
            <th style={cell}>Error</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect?.(r)}
              style={{ cursor: onSelect ? "pointer" : undefined }}
            >
              <td style={cell}>{new Date(r.created_at).toLocaleString()}</td>
              <td style={cell}>{r.rule_name}</td>
              <td style={cell}>{r.rule_version}</td>
              <td style={{ ...cell, fontFamily: "monospace" }}>
                {truncate(JSON.stringify(r.result), 60)}
              </td>
              <td style={cell}>{r.performance ?? "—"}</td>
              <td style={cell}>{r.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
  fontSize: 13,
};

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
