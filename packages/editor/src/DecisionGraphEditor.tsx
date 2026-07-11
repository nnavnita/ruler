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

// Emerald palette. Green reads as "success" without any explanation.
const HIT_STROKE = "#16a34a"; // emerald-600

/**
 * Visual JDM editor. Wraps `@gorules/jdm-editor` and layers a bold green
 * "this ran successfully" treatment on hit nodes, edges, and the matched
 * switch statement.
 *
 * Deliberately light-mode only — jdm-editor's node chrome doesn't
 * respond well to prefers-color-scheme, and forcing a dark theme on top
 * clashes with the ant-design token palette underneath.
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
              style: { stroke: HIT_STROKE, strokeWidth: 3.5 },
              markerEnd: {
                type: "arrowclosed",
                color: HIT_STROKE,
                width: 22,
                height: 22,
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

  const edgeStyleTag = useMemo(() => {
    if (hitEdgeIds.size === 0) return null;
    const stroke = Array.from(hitEdgeIds)
      .flatMap((id) => {
        const esc = id.replace(/["\\]/g, "\\$&");
        return [
          `.ruler-graph [data-id="${esc}"] .react-flow__edge-path`,
          `.ruler-graph [data-id="${esc}"] path.react-flow__edge-path`,
          `.ruler-graph [data-testid="rf__edge-${esc}"] .react-flow__edge-path`,
          `.ruler-graph g[data-id="${esc}"] path`,
        ];
      })
      .join(",\n");
    const arrows = Array.from(hitEdgeIds)
      .flatMap((id) => {
        const esc = id.replace(/["\\]/g, "\\$&");
        return [
          `.ruler-graph [data-id="${esc}"] marker polygon`,
          `.ruler-graph [data-id="${esc}"] marker path`,
        ];
      })
      .join(",\n");
    return (
      <style>{`
        ${stroke} {
          stroke: ${HIT_STROKE} !important;
          stroke-width: 3.5px !important;
          filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.75));
        }
        ${arrows} {
          fill: ${HIT_STROKE} !important;
          stroke: ${HIT_STROKE} !important;
        }
      `}</style>
    );
  }, [hitEdgeIds]);

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
      {edgeStyleTag}
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
      /* Green success emphasis on hit nodes. Keep jdm-editor's own body
         styling — we only add an outline + glow around the outside so
         the node stays readable and the "this ran" signal is loud. */
      .ruler-graph .grl-dn--success {
        outline: 3px solid ${HIT_STROKE};
        outline-offset: 2px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.55);
      }

      /* Matched switch statement row — same green treatment, obvious
         but not overpowering. */
      .ruler-graph .ruler-hit-statement {
        outline: 2px solid ${HIT_STROKE} !important;
        outline-offset: 1px;
        background: rgba(34, 197, 94, 0.18) !important;
        border-radius: 6px;
        box-shadow: inset 0 0 0 1px ${HIT_STROKE};
      }

      /* Hit edge base treatment via the 'animated' class we set on the
         edge value. Reactflow adds this class when animated=true. */
      .ruler-graph .react-flow__edge.animated .react-flow__edge-path,
      .ruler-graph .react-flow__edge.ruler-hit-edge .react-flow__edge-path {
        stroke: ${HIT_STROKE} !important;
        stroke-width: 3.5px !important;
        filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.75));
      }
      .ruler-graph .react-flow__edge.animated marker polygon,
      .ruler-graph .react-flow__edge.animated marker path,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker polygon,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker path {
        fill: ${HIT_STROKE} !important;
        stroke: ${HIT_STROKE} !important;
      }
    `.replace(/\$\{HIT_STROKE\}/g, HIT_STROKE);
    document.head.appendChild(el);
  }, []);
  return null;
}
