import { DecisionGraph, JdmConfigProvider } from "@gorules/jdm-editor";
import "@gorules/jdm-editor/dist/style.css";
import { useMemo } from "react";
import type { EvaluationResponse, JdmContent } from "./types";

export interface DecisionGraphEditorProps {
  /** JDM decision graph content. */
  value: JdmContent;
  /** Called when the user edits the graph. */
  onChange?: (next: JdmContent) => void;
  /** Optional evaluation result. Lights up executed nodes in the graph. */
  trace?: EvaluationResponse | null;
  /** Optional CSS class applied to the outer wrapper. */
  className?: string;
  /** Optional inline style applied to the outer wrapper. */
  style?: React.CSSProperties;
  /** Hide the toolbar (useful for read-only views). */
  disabled?: boolean;
}

/**
 * Visual JDM editor. Thin wrapper over `@gorules/jdm-editor`'s DecisionGraph
 * that plugs in Ruler evaluation traces via the `simulate` prop so executed
 * nodes light up in place.
 */
export function DecisionGraphEditor(props: DecisionGraphEditorProps) {
  const { value, onChange, trace, className, style, disabled } = props;

  const simulate = useMemo(() => {
    if (!trace) return undefined;
    return {
      result: {
        performance: trace.performance ?? undefined,
        result: trace.result,
        trace: trace.trace ?? {},
      },
    };
  }, [trace]);

  return (
    <JdmConfigProvider>
      <div className={className} style={{ height: "100%", ...style }}>
        <DecisionGraph
          value={value as never}
          onChange={onChange as never}
          simulate={simulate as never}
          disabled={disabled}
        />
      </div>
    </JdmConfigProvider>
  );
}
