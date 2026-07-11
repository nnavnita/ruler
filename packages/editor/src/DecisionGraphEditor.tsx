import { DecisionGraph, JdmConfigProvider } from "@gorules/jdm-editor";
import "@gorules/jdm-editor/dist/style.css";
import { useEffect, useMemo, useRef } from "react";
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
 * Visual JDM editor. Wraps `@gorules/jdm-editor`'s DecisionGraph with:
 * - stronger amber emphasis on executed nodes (both light + dark themes)
 * - post-render DOM tagging so executed edges glow amber
 * - post-render DOM tagging so the specific matched statement inside a
 *   switch node gets an amber accent alongside the whole node's ring
 */
export function DecisionGraphEditor(props: DecisionGraphEditorProps) {
  const { value, onChange, trace, className, style, disabled } = props;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  const { hitEdgeIds, hitStatements } = useMemo(() => {
    if (!trace?.trace) return { hitEdgeIds: [] as string[], hitStatements: [] as string[] };
    const traceMap = trace.trace;
    const graph = value as unknown as {
      nodes?: JdmNodeLite[];
      edges?: JdmEdgeLite[];
    };
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    const edgeIds: string[] = [];
    const stmtIds: string[] = [];
    for (const e of edges) {
      const src = nodesById.get(e.sourceId);
      const srcTrace = traceMap[e.sourceId];
      const tgtTrace = traceMap[e.targetId];
      if (!srcTrace || !tgtTrace) continue;
      if (src?.type === "switchNode" && e.sourceHandle) {
        const raw = srcTrace as Record<string, unknown>;
        const sw =
          ((raw.traceData ?? raw.trace_data) as SwitchTraceData | undefined) ??
          undefined;
        const fired = sw?.statements ?? [];
        if (!fired.some((s) => s.id === e.sourceHandle)) continue;
        stmtIds.push(...fired.map((s) => s.id));
      }
      edgeIds.push(e.id);
    }
    return { hitEdgeIds: edgeIds, hitStatements: Array.from(new Set(stmtIds)) };
  }, [value, trace]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const applied: HTMLElement[] = [];

    // Give the DOM a tick to catch up with reactflow's rerender.
    const raf = window.requestAnimationFrame(() => {
      // Clear previous hits.
      root
        .querySelectorAll<HTMLElement>(".ruler-hit-edge, .ruler-hit-statement")
        .forEach((el) => {
          el.classList.remove("ruler-hit-edge");
          el.classList.remove("ruler-hit-statement");
        });

      for (const edgeId of hitEdgeIds) {
        // reactflow tags each edge <g> with either `data-id` or
        // `data-testid` depending on version; try both.
        const escaped = edgeId.replace(/["\\]/g, "\\$&");
        const el =
          root.querySelector<HTMLElement>(`[data-id="${escaped}"]`) ??
          root.querySelector<HTMLElement>(
            `[data-testid="rf__edge-${escaped}"]`,
          );
        if (el) {
          el.classList.add("ruler-hit-edge");
          applied.push(el);
        }
      }

      for (const stmtId of hitStatements) {
        const escaped = stmtId.replace(/["\\]/g, "\\$&");
        // jdm-editor's switch node renders each statement row somewhere
        // under a container that carries the statement's id. Try several
        // known selectors.
        const el =
          root.querySelector<HTMLElement>(`[data-id="${escaped}"]`) ??
          root.querySelector<HTMLElement>(`[data-statement-id="${escaped}"]`) ??
          root.querySelector<HTMLElement>(`[data-key="${escaped}"]`);
        if (el) {
          el.classList.add("ruler-hit-statement");
          applied.push(el);
        }
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      applied.forEach((el) => {
        el.classList.remove("ruler-hit-edge");
        el.classList.remove("ruler-hit-statement");
      });
    };
  }, [hitEdgeIds, hitStatements, value, trace]);

  return (
    <JdmConfigProvider>
      <RulerGraphStyles />
      <div
        ref={wrapperRef}
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
  useMemo(() => {
    if (stylesInjected || typeof document === "undefined") return;
    stylesInjected = true;
    const el = document.createElement("style");
    el.setAttribute("data-ruler-graph", "");
    el.textContent = `
      /* --- Hit node styling ---------------------------------------- */
      .ruler-graph .grl-dn--success {
        --node-background: #fef3c7;
        box-shadow: 0 0 0 2px #f59e0b, 0 0 12px rgba(251, 191, 36, 0.6);
        border-radius: 8px;
      }
      @media (prefers-color-scheme: dark) {
        .ruler-graph .grl-dn--success {
          --node-background: #3b2f0d;
          box-shadow: 0 0 0 2px #fbbf24, 0 0 18px rgba(251, 191, 36, 0.55);
        }
        /* Force header + body text to a light palette so the dark
           amber node stays readable. */
        .ruler-graph .grl-dn--success,
        .ruler-graph .grl-dn--success .grl-dn__header__title,
        .ruler-graph .grl-dn--success .grl-dn__header__handle,
        .ruler-graph .grl-dn--success .grl-dn__content,
        .ruler-graph .grl-dn--success .grl-dn__content * {
          color: #fef3c7 !important;
        }
      }

      /* --- Hit edge styling --------------------------------------- */
      .ruler-graph .react-flow__edge-path {
        transition: stroke 0.15s ease, stroke-width 0.15s ease;
      }
      .ruler-graph .ruler-hit-edge .react-flow__edge-path,
      .ruler-graph .ruler-hit-edge path.react-flow__edge-path {
        stroke: #f59e0b !important;
        stroke-width: 3px !important;
        filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.75));
      }
      .ruler-graph .ruler-hit-edge .react-flow__edge-path-selector {
        stroke-width: 24px !important;
      }
      /* Any animated marker (arrowhead) on the winning edge. */
      .ruler-graph .ruler-hit-edge marker path,
      .ruler-graph .ruler-hit-edge polygon {
        fill: #f59e0b !important;
        stroke: #f59e0b !important;
      }

      /* --- Hit statement row (inside switch node) ---------------- */
      .ruler-graph .ruler-hit-statement {
        background: rgba(251, 191, 36, 0.32) !important;
        border-left: 4px solid #f59e0b !important;
        box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.55),
                    0 0 8px rgba(251, 191, 36, 0.6);
        border-radius: 4px;
      }
      @media (prefers-color-scheme: dark) {
        .ruler-graph .ruler-hit-statement {
          background: rgba(251, 191, 36, 0.22) !important;
          border-left-color: #fbbf24 !important;
          color: #fef3c7 !important;
        }
      }
      /* Also emphasise expression rows that fired (traceData exposes
         a { [key]: { result } } object). */
      .ruler-graph .ruler-hit-expression {
        background: rgba(251, 191, 36, 0.28) !important;
        border-left: 4px solid #f59e0b !important;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}
