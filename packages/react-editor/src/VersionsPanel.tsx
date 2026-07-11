import { useCallback, useEffect, useState } from "react";
import type { RulerClient } from "./client";
import type { RuleVersion, StatusTransition } from "./types";

export interface VersionsPanelProps {
  client: RulerClient;
  ruleName: string;
  /** Called when the user picks a version to inspect. */
  onSelect?: (version: RuleVersion) => void;
  /** Called after any successful transition (submit/approve/publish/…). */
  onChange?: () => void;
  className?: string;
}

/**
 * Version history + status transitions for a rule. Shows every version,
 * its status pill, and buttons appropriate for its current state.
 */
export function VersionsPanel(props: VersionsPanelProps) {
  const { client, ruleName, onSelect, onChange, className } = props;
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVersions(await client.listVersions(ruleName));
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }, [client, ruleName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const transition = async (v: RuleVersion, action: StatusTransition) => {
    setPendingId(`${v.version}:${action}`);
    try {
      await client.transitionVersion(ruleName, v.version, action);
      await refresh();
      onChange?.();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className={className}>
      {error && (
        <div className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-slate-500">
            <th className="px-2 py-1">v</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Author</th>
            <th className="px-2 py-1">Created</th>
            <th className="px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr
              key={v.version}
              className="border-b last:border-b-0 hover:bg-slate-50"
            >
              <td
                onClick={() => onSelect?.(v)}
                className="cursor-pointer px-2 py-1 font-mono"
              >
                {v.version}
              </td>
              <td className="px-2 py-1">
                <StatusPill status={v.status} />
              </td>
              <td className="px-2 py-1 text-slate-600">{v.author ?? "—"}</td>
              <td className="px-2 py-1 text-xs text-slate-500">
                {new Date(v.created_at).toLocaleString()}
              </td>
              <td className="px-2 py-1">
                <div className="flex flex-wrap gap-1">
                  {v.status === "draft" && (
                    <>
                      <ActionBtn
                        pending={pendingId === `${v.version}:submit`}
                        onClick={() => transition(v, "submit")}
                      >
                        Submit
                      </ActionBtn>
                      <ActionBtn
                        pending={pendingId === `${v.version}:publish`}
                        onClick={() => transition(v, "publish")}
                      >
                        Publish
                      </ActionBtn>
                    </>
                  )}
                  {v.status === "review" && (
                    <>
                      <ActionBtn
                        pending={pendingId === `${v.version}:approve`}
                        onClick={() => transition(v, "approve")}
                      >
                        Approve
                      </ActionBtn>
                      <ActionBtn
                        pending={pendingId === `${v.version}:reject`}
                        onClick={() => transition(v, "reject")}
                      >
                        Reject
                      </ActionBtn>
                      <ActionBtn
                        pending={pendingId === `${v.version}:publish`}
                        onClick={() => transition(v, "publish")}
                      >
                        Publish
                      </ActionBtn>
                    </>
                  )}
                  {(v.status === "draft" || v.status === "review") && (
                    <ActionBtn
                      pending={pendingId === `${v.version}:archive`}
                      onClick={() => transition(v, "archive")}
                    >
                      Archive
                    </ActionBtn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBtn(props: {
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.pending}
      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
    >
      {props.pending ? "…" : props.children}
    </button>
  );
}

function StatusPill({ status }: { status: RuleVersion["status"] }) {
  const styles: Record<RuleVersion["status"], string> = {
    draft: "bg-slate-100 text-slate-700",
    review: "bg-amber-100 text-amber-800",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-slate-200 text-slate-500",
  };
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
        styles[status]
      }
    >
      {status}
    </span>
  );
}
