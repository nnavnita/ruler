import { useState } from "react";
import { EditorView } from "./views/EditorView";
import { LogsView } from "./views/LogsView";
import { VersionsView } from "./views/VersionsView";
import { TestsView } from "./views/TestsView";

type Tab = "editor" | "versions" | "tests" | "logs";

export function App() {
  const [tab, setTab] = useState<Tab>("editor");
  const [ruleName, setRuleName] = useState("demo");

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center gap-6 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">Ruler</span>
          <span className="text-xs text-slate-500">JDM rule studio</span>
        </div>
        <nav className="flex gap-1">
          <TabButton active={tab === "editor"} onClick={() => setTab("editor")}>
            Editor
          </TabButton>
          <TabButton active={tab === "versions"} onClick={() => setTab("versions")}>
            Versions
          </TabButton>
          <TabButton active={tab === "tests"} onClick={() => setTab("tests")}>
            Tests
          </TabButton>
          <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
            Execution logs
          </TabButton>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <label>Rule</label>
          <input
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs"
          />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === "editor" && <EditorView ruleName={ruleName} />}
        {tab === "versions" && <VersionsView ruleName={ruleName} />}
        {tab === "tests" && <TestsView ruleName={ruleName} />}
        {tab === "logs" && <LogsView />}
      </main>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm font-medium transition " +
        (props.active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100")
      }
    >
      {props.children}
    </button>
  );
}
