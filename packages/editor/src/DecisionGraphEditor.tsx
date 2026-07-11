import { DecisionGraph, JdmConfigProvider } from "@gorules/jdm-editor";
import "@gorules/jdm-editor/dist/style.css";
import { theme as antdTheme } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationResponse, JdmContent } from "./types";

export type DecisionGraphTheme = "light" | "dark" | "auto";

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
  /**
   * Theme to render the graph in. `"auto"` follows either the nearest
   * ancestor with class `dark` on `<html>`, or `prefers-color-scheme`
   * when nothing has been explicitly picked. Defaults to `"auto"`.
   */
  theme?: DecisionGraphTheme;
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

const HIT_STROKE = "#16a34a";

/**
 * Visual JDM editor. Wraps `@gorules/jdm-editor` and:
 *
 * - Respects the app's dark / light theme by passing `theme` through to
 *   `JdmConfigProvider` (using ant-design's `darkAlgorithm` in dark mode).
 * - Layers a green "successfully executed" treatment onto hit nodes,
 *   edges, and the matched switch statement, styled to read on either
 *   theme.
 */
export function DecisionGraphEditor(props: DecisionGraphEditorProps) {
  const { value, onChange, trace, className, style, disabled, theme = "auto" } = props;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isDark = useIsDark(theme);

  const antTheme = useMemo(
    () =>
      isDark
        ? { algorithm: antdTheme.darkAlgorithm }
        : { algorithm: antdTheme.defaultAlgorithm },
    [isDark],
  );

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
    <JdmConfigProvider theme={antTheme as never}>
      <RulerGraphStyles />
      {edgeStyleTag}
      <div
        ref={wrapperRef}
        data-theme={isDark ? "dark" : "light"}
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

function useIsDark(pref: DecisionGraphTheme): boolean {
  const [dark, setDark] = useState<boolean>(() => resolveDark(pref));

  useEffect(() => {
    if (pref !== "auto") {
      setDark(pref === "dark");
      return;
    }

    setDark(resolveDark(pref));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => setDark(resolveDark(pref));
    media.addEventListener("change", onMediaChange);

    const observer = new MutationObserver(() => setDark(resolveDark(pref)));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      media.removeEventListener("change", onMediaChange);
      observer.disconnect();
    };
  }, [pref]);

  return dark;
}

function resolveDark(pref: DecisionGraphTheme): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  if (typeof document === "undefined") return false;
  // Explicit choice on <html> wins over prefers-color-scheme.
  const el = document.documentElement;
  if (el.classList.contains("dark") || el.dataset.theme === "dark") return true;
  if (el.classList.contains("light") || el.dataset.theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let stylesInjected = false;

function RulerGraphStyles() {
  useMemo(() => {
    if (stylesInjected || typeof document === "undefined") return;
    stylesInjected = true;
    const el = document.createElement("style");
    el.setAttribute("data-ruler-graph", "");
    el.textContent = `
      /* Green success emphasis on hit nodes — same treatment on both
         themes, since jdm-editor already recolours the interior
         appropriately via ant-design's dark algorithm. */
      .ruler-graph .grl-dn--success {
        outline: 3px solid #16a34a;
        outline-offset: 2px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.55);
      }

      /* Matched switch statement row. */
      .ruler-graph .ruler-hit-statement {
        outline: 2px solid #16a34a !important;
        outline-offset: 1px;
        background: rgba(34, 197, 94, 0.18) !important;
        border-radius: 6px;
        box-shadow: inset 0 0 0 1px #16a34a;
      }

      /* Hit edge base treatment via the animated class. */
      .ruler-graph .react-flow__edge.animated .react-flow__edge-path,
      .ruler-graph .react-flow__edge.ruler-hit-edge .react-flow__edge-path {
        stroke: #16a34a !important;
        stroke-width: 3.5px !important;
        filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.75));
      }
      .ruler-graph .react-flow__edge.animated marker polygon,
      .ruler-graph .react-flow__edge.animated marker path,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker polygon,
      .ruler-graph .react-flow__edge.ruler-hit-edge marker path {
        fill: #16a34a !important;
        stroke: #16a34a !important;
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}
