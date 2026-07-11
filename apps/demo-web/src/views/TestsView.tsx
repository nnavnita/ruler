import { TestsPanel } from "@ruler/react-editor";
import { rulerClient } from "../lib/client";

export function TestsView({ ruleName }: { ruleName: string }) {
  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="mb-3 text-lg font-semibold">
        Tests <span className="text-sm font-normal text-slate-500">for {ruleName}</span>
      </h2>
      <TestsPanel client={rulerClient} ruleName={ruleName} />
    </div>
  );
}
