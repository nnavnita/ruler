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

interface JdmEdgeLite {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
}

interface JdmNodeLite {
  id: string;
  type: string;
}

interface SwitchTraceData {
  statements?: { id: string }[];
}

/**
 * Visual JDM editor. Wraps `@gorules/jdm-editor`'s DecisionGraph and plugs in
 * Ruler evaluation traces via the `simulate` prop so executed nodes and edges
 * are highlighted with an amber accent + drop-shadow glow.
 *
 * Node highlighting: driven by jdm-editor's built-in `.grl-dn--success` class
 * (overridden here for stronger visual weight).
 *
 * Edge highlighting: computed from the trace — an edge is "hit" when both its
 * source and target nodes are in the trace, AND for switch sources, the
 * edge's `sourceHandle` matches a fired statement. Emitted as a scoped
 * `<style>` block that targets reactflow's `data-id="<edgeId>"` attribute.
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

  const hitEdgeIds = useMemo(() => {
    if (!trace?.trace) return [] as string[];
    const traceMap = trace.trace;
    const graph = value as unknown as {
      nodes?: JdmNodeLite[];
      edges?: JdmEdgeLite[];
    };
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    const hit: string[] = [];
    for (const e of edges) {
      const src = nodesById.get(e.sourceId);
      const srcTrace = traceMap[e.sourceId];
      const tgtTrace = traceMap[e.targetId];
      if (!srcTrace || !tgtTrace) continue;
      if (src?.type === "switchNode" && e.sourceHandle) {
        // Accept both camelCase (jdm-editor / our interpreter) and snake_case
        // (some GoRules Python payloads) here.
        const raw = srcTrace as Record<string, unknown>;
        const sw =
          ((raw.traceData ?? raw.trace_data) as SwitchTraceData | undefined) ??
          undefined;
        const fired = sw?.statements ?? [];
        if (!fired.some((s) => s.id === e.sourceHandle)) continue;
      }
      hit.push(e.id);
    }
    return hit;
  }, [value, trace]);

  const styleTag = useMemo(() => {
    if (hitEdgeIds.length === 0) return null;
    const selectors = hitEdgeIds
      .map((id) => `.ruler-graph [data-id="${cssEscape(id)}"]`)
      .join(", ");
    return (
      <style>{`
        ${selectors} .react-flow__edge-path {
          stroke: #f59e0b !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.7));
        }
        ${selectors} .react-flow__edge-path-selector {
          stroke-width: 20px !important;
        }
      `}</style>
    );
  }, [hitEdgeIds]);

  return (
    <JdmConfigProvider>
      <RulerGraphStyles />
      {styleTag}
      <div
        className={"ruler-graph " + (className ?? "")}
        style={{ height: "100%", ...style }}
      >
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

let stylesInjected = false;

function RulerGraphStyles() {
  // Inject once at module level. `useMemo` isn't ideal but avoids a hard
  // dependency on a stylesheet file inside the package.
  useMemo(() => {
    if (stylesInjected || typeof document === "undefined") return;
    stylesInjected = true;
    const el = document.createElement("style");
    el.setAttribute("data-ruler-graph", "");
    el.textContent = `
      /* Stronger emphasis on jdm-editor's "trace hit" nodes. */
      .ruler-graph .grl-dn--success {
        --node-background: #fef3c7;
        box-shadow: 0 0 0 2px #f59e0b, 0 0 12px rgba(251, 191, 36, 0.6);
        border-radius: 8px;
      }
      @media (prefers-color-scheme: dark) {
        .ruler-graph .grl-dn--success {
          --node-background: #3b2f0d;
          box-shadow: 0 0 0 2px #fbbf24, 0 0 16px rgba(251, 191, 36, 0.55);
        }
      }
      /* Base edge colour a touch stronger so hit edges stand out. */
      .ruler-graph .react-flow__edge-path {
        transition: stroke 0.15s ease, stroke-width 0.15s ease;
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}

/** Minimal CSS.escape polyfill for the edge ids we generate. */
function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
