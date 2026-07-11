import { ReplayPanel, VersionsPanel } from "@ruler/react-editor";
import type { RuleVersion } from "@ruler/react-editor";
import { useState } from "react";
import { rulerClient } from "../lib/client";

export function VersionsView({ ruleName }: { ruleName: string }) {
  const [selected, setSelected] = useState<RuleVersion | null>(null);

  return (
    <div className="grid h-full grid-cols-[420px_1fr]">
      <div className="overflow-auto border-r border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Versions
        </h2>
        <VersionsPanel
          client={rulerClient}
          ruleName={ruleName}
          onSelect={setSelected}
        />
      </div>

      <div className="overflow-auto p-4">
        {selected ? (
          <>
            <h2 className="mb-1 text-lg font-semibold">
              v{selected.version}{" "}
              <span className="ml-2 text-xs uppercase text-slate-500">
                {selected.status}
              </span>
            </h2>
            {selected.notes && (
              <p className="mb-3 text-sm text-slate-600">{selected.notes}</p>
            )}
            <div className="mb-4">
              <ReplayPanel
                client={rulerClient}
                ruleName={ruleName}
                version={selected.version}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Content
              </h3>
              <pre className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
                {JSON.stringify(selected.content, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Pick a version on the left to inspect + replay it.
          </p>
        )}
      </div>
    </div>
  );
}
