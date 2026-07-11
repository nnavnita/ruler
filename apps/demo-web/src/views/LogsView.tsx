import { LogsViewer } from "@ruler/react-editor";
import type { AuditRecord } from "@ruler/react-editor";
import { useState } from "react";
import { rulerClient } from "../lib/client";

export function LogsView() {
  const [selected, setSelected] = useState<AuditRecord | null>(null);

  return (
    <div className="grid h-full grid-cols-[1fr_420px]">
      <div className="overflow-auto p-4">
        <LogsViewer
          client={rulerClient}
          onSelect={setSelected}
          refreshMs={5000}
        />
      </div>
      <aside className="flex flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detail
        </div>
        <pre className="flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs text-slate-100">
{selected ? JSON.stringify(selected, null, 2) : "// click a row to inspect"}
        </pre>
      </aside>
    </div>
  );
}
