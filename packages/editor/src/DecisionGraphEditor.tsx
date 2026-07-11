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

const HIT_STROKE = "#f59e0b";

/**
 * Visual JDM editor. Layers amber-glow trace highlighting on top of
 * `@gorules/jdm-editor`.
 *
 * jdm-editor renders decision-graph nodes with a dark chrome regardless
 * of the surrounding page theme, so hit-node styling is always the same
 * dark-amber-inside-with-amber-outline look — no media query.
 *
 * Edges are hard to select from CSS reliably, so we do two things:
 *   1) mutate the value handed to <DecisionGraph> to set `animated: true`
 *      + a per-edge inline style. Reactflow spreads these through in
 *      most rendering paths.
 *   2) emit a scoped inline <style> block keyed off `data-id="<edgeId>"`
 *      so we still win when (1) is silently dropped.
 * onChange strips the synthetic props before bubbling up so parent
 * state stays clean JDM.
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
              style: {
                stroke: HIT_STROKE,
                strokeWidth: 3.5,
              },
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
    const selectors = Array.from(hitEdgeIds)
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
    const arrowSelectors = Array.from(hitEdgeIds)
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
        ${selectors} {
          stroke: ${HIT_STROKE} !important;
          stroke-width: 3.5px !important;
          filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.85));
        }
        ${arrowSelectors} {
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
      /* jdm-editor nodes are dark-themed regardless of page theme, so
         apply the amber-on-dark treatment universally — no media
         query, no light-body/light-text clash. */

      .ruler-graph .grl-dn--success {
        --node-background: #1f180a !important;
        outline: 3px solid #f59e0b;
        outline-offset: 2px;
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(251, 191, 36, 0.6);
      }
      /* Belt-and-braces: paint every plausible body container directly
         in case jdm-editor's success-bg variable is read from a token
         we haven't intercepted. */
      .ruler-graph .grl-dn--success,
      .ruler-graph .grl-dn--success .grl-dn__graphCard,
      .ruler-graph .grl-dn--success .grl-dn__body,
      .ruler-graph .grl-dn--success .grl-dn__cn,
      .ruler-graph .grl-dn--success .grl-dn__cn__form,
      .ruler-graph .grl-dn--success .grl-dn__footer,
      .ruler-graph .grl-dn--success .grl-dn__details,
      .ruler-graph .grl-dn--success .cm-editor,
      .ruler-graph .grl-dn--success .cm-editor .cm-scroller,
      .ruler-graph .grl-dn--success .cm-editor .cm-gutters {
        background: #1f180a !important;
        background-color: #1f180a !important;
      }
      /* Force every descendant text to a light peach so nothing stays
         dark on the dark amber body. Skip icons / SVG stroke colours. */
      .ruler-graph .grl-dn--success,
      .ruler-graph .grl-dn--success *:not(svg):not(path):not(polygon):not(rect):not(circle):not(line):not(button) {
        color: #fef3c7 !important;
      }
      .ruler-graph .grl-dn--success svg { color: #fef3c7 !important; }
      /* jdm-editor uses CodeMirror for expression editing; syntax-
         highlight tokens end up on the dark body and must be forced to
         legible colours too. */
      .ruler-graph .grl-dn--success .cm-editor,
      .ruler-graph .grl-dn--success .cm-editor .cm-content,
      .ruler-graph .grl-dn--success .cm-editor .cm-line {
        color: #fed7aa !important;
        background: transparent !important;
      }
      .ruler-graph .grl-dn--success .cm-editor .tok-string { color: #fcd34d !important; }
      .ruler-graph .grl-dn--success .cm-editor .tok-keyword { color: #fdba74 !important; }
      .ruler-graph .grl-dn--success .cm-editor .tok-atom { color: #fdba74 !important; }
      .ruler-graph .grl-dn--success .cm-editor .tok-variableName { color: #fed7aa !important; }
      .ruler-graph .grl-dn--success .cm-editor .tok-number { color: #fcd34d !important; }
      .ruler-graph .grl-dn--success .cm-editor .tok-operator { color: #fdba74 !important; }

      /* Hit switch statement row — force amber wash + light text
         regardless of theme. */
      .ruler-graph .ruler-hit-statement,
      .ruler-graph .ruler-hit-statement * {
        background: transparent;
        color: #1f180a !important;
      }
      .ruler-graph .ruler-hit-statement {
        background: #fbbf24 !important;
        border: 2px solid #f59e0b !important;
        border-radius: 6px;
        box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
      }

      /* Hit edge base treatment via the 'animated' class we set on the
         value. Reactflow adds this class when animated=true is on the
         edge object. */
      .ruler-graph .react-flow__edge.animated .react-flow__edge-path,
      .ruler-graph .react-flow__edge.ruler-hit-edge .react-flow__edge-path {
        stroke: #f59e0b !important;
        stroke-width: 3.5px !important;
        filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.85));
      }
      .ruler-graph .react-flow__edge.animated marker polygon,
      .ruler-graph .react-flow__edge.animated marker path,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker polygon,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker path {
        fill: #f59e0b !important;
        stroke: #f59e0b !important;
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}
