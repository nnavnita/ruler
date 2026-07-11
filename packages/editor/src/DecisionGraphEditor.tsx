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
  [k: string]: unknown;
}

interface JdmNodeLite {
  id: string;
  type: string;
}

interface SwitchTraceData {
  statements?: { id: string }[];
}

const HIT_EDGE_STROKE = "#f59e0b";
const HIT_EDGE_STYLE = {
  stroke: HIT_EDGE_STROKE,
  strokeWidth: 3.5,
  filter: "drop-shadow(0 0 6px rgba(251, 191, 36, 0.75))",
};

/**
 * Visual JDM editor. Layers amber-glow trace highlighting on top of
 * `@gorules/jdm-editor`.
 *
 * Approach:
 * 1. Nodes — jdm-editor tags trace hits with `.grl-dn--success`; we
 *    override that class with an unmistakable amber ring + light text.
 * 2. Edges — reactflow won't tag them by our JDM edge ids, so we mutate
 *    the value handed to <DecisionGraph> and set `animated: true` +
 *    a per-edge `style` on hits. onChange strips those synth fields so
 *    parent state stays clean.
 * 3. Switch statement rows — MutationObserver walks the wrapper and
 *    tags matched rows via id-attributes we can find.
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

  const { hitEdgeIds, hitStatementIds } = useMemo(() => {
    if (!trace?.trace)
      return { hitEdgeIds: new Set<string>(), hitStatementIds: new Set<string>() };
    const traceMap = trace.trace;
    const graph = value as unknown as {
      nodes?: JdmNodeLite[];
      edges?: JdmEdgeLite[];
    };
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    const edgeIds = new Set<string>();
    const stmtIds = new Set<string>();
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
        for (const s of fired) stmtIds.add(s.id);
      }
      edgeIds.add(e.id);
    }
    return { hitEdgeIds: edgeIds, hitStatementIds: stmtIds };
  }, [value, trace]);

  const decoratedValue = useMemo(() => {
    if (hitEdgeIds.size === 0) return value;
    const graph = value as unknown as { edges?: JdmEdgeLite[] };
    const edges = graph.edges ?? [];
    return {
      ...(value as object),
      edges: edges.map((e) =>
        hitEdgeIds.has(e.id)
          ? {
              ...e,
              animated: true,
              className: "ruler-hit-edge",
              style: HIT_EDGE_STYLE,
              markerEnd: {
                type: "arrowclosed",
                color: HIT_EDGE_STROKE,
                width: 20,
                height: 20,
              },
            }
          : e,
      ),
    } as JdmContent;
  }, [value, hitEdgeIds]);

  const handleChange = useMemo(() => {
    if (!onChange) return undefined;
    return (next: JdmContent) => {
      const graph = next as unknown as { edges?: JdmEdgeLite[] };
      const edges = graph.edges ?? [];
      const stripped = edges.map((e) => {
        // Drop synthetic decoration keys before bubbling up to parent.
        const { animated: _a, className: _c, style: _s, markerEnd: _m, ...rest } =
          e as Record<string, unknown>;
        void _a;
        void _c;
        void _s;
        void _m;
        return rest as unknown as JdmEdgeLite;
      });
      onChange({ ...(next as object), edges: stripped } as JdmContent);
    };
  }, [onChange]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root || hitStatementIds.size === 0) return;

    const apply = () => {
      root
        .querySelectorAll<HTMLElement>(".ruler-hit-statement")
        .forEach((el) => el.classList.remove("ruler-hit-statement"));
      for (const id of hitStatementIds) {
        const esc = id.replace(/["\\]/g, "\\$&");
        const el =
          root.querySelector<HTMLElement>(`[data-id="${esc}"]`) ??
          root.querySelector<HTMLElement>(`[data-statement-id="${esc}"]`) ??
          root.querySelector<HTMLElement>(`[data-key="${esc}"]`) ??
          root.querySelector<HTMLElement>(`[id="${esc}"]`);
        if (el) el.classList.add("ruler-hit-statement");
      }
    };

    apply();
    const mo = new MutationObserver(() => apply());
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [hitStatementIds, value, trace]);

  return (
    <JdmConfigProvider>
      <RulerGraphStyles />
      <div
        ref={wrapperRef}
        className={"ruler-graph " + (className ?? "")}
        style={{ height: "100%", ...style }}
      >
        <DecisionGraph
          value={decoratedValue as never}
          onChange={handleChange as never}
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
      /* ============================================================
       * Hit node
       * ============================================================ */
      .ruler-graph .grl-dn--success {
        --node-background: #fef3c7;
        outline: 3px solid #f59e0b;
        outline-offset: 2px;
        border-radius: 10px;
        box-shadow: 0 0 22px rgba(251, 191, 36, 0.65);
      }
      /* Ensure header + body content stay readable. Nuclear color reset
         so jdm-editor's internal syntax highlights don't override. */
      @media (prefers-color-scheme: dark) {
        .ruler-graph .grl-dn--success {
          --node-background: #1f180a;
          outline-color: #fbbf24;
          box-shadow: 0 0 26px rgba(251, 191, 36, 0.55);
        }
        .ruler-graph .grl-dn--success,
        .ruler-graph .grl-dn--success *:not(button):not(svg):not(path) {
          color: #fef3c7 !important;
        }
        /* Preserve icon / SVG stroke colours */
        .ruler-graph .grl-dn--success svg { color: #fef3c7 !important; }
        /* jdm-editor's expression / syntax highlight tokens sit on the
           node body — bump them to a light accent so they don't blend
           with the amber background. */
        .ruler-graph .grl-dn--success .cm-editor,
        .ruler-graph .grl-dn--success .cm-editor .cm-content,
        .ruler-graph .grl-dn--success .cm-editor .cm-line,
        .ruler-graph .grl-dn--success .cm-editor .tok-string,
        .ruler-graph .grl-dn--success .cm-editor .tok-keyword,
        .ruler-graph .grl-dn--success .cm-editor .tok-variableName,
        .ruler-graph .grl-dn--success .cm-editor .tok-atom {
          color: #fed7aa !important;
          background: transparent !important;
        }
      }

      /* ============================================================
       * Hit edge
       * Reactflow's animated class gives us the base treatment; we
       * repaint stroke + width + glow.
       * ============================================================ */
      .ruler-graph .react-flow__edge.animated .react-flow__edge-path,
      .ruler-graph .react-flow__edge.ruler-hit-edge .react-flow__edge-path,
      .ruler-graph g.ruler-hit-edge path.react-flow__edge-path {
        stroke: #f59e0b !important;
        stroke-width: 3.5px !important;
        filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.75));
      }
      .ruler-graph .react-flow__edge.animated marker polygon,
      .ruler-graph .react-flow__edge.animated marker path,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker polygon,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker path {
        fill: #f59e0b !important;
        stroke: #f59e0b !important;
      }

      /* ============================================================
       * Hit switch statement row
       * ============================================================ */
      .ruler-graph .ruler-hit-statement {
        background: rgba(251, 191, 36, 0.36) !important;
        border-left: 5px solid #f59e0b !important;
        box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.65),
                    0 0 10px rgba(251, 191, 36, 0.55);
        border-radius: 6px;
      }
      @media (prefers-color-scheme: dark) {
        .ruler-graph .ruler-hit-statement,
        .ruler-graph .ruler-hit-statement * {
          color: #fef3c7 !important;
        }
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}
