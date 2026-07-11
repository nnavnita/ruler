/**
 * Client-side JDM interpreter.
 *
 * The published `@gorules/zen-engine-wasm` (0.23) only exposes the expression
 * runtime, not a full decision-graph evaluator. So we walk the graph in JS
 * and delegate per-node expression work to `evaluateExpression` from WASM.
 *
 * Supported node kinds (enough for the demo rule):
 * - inputNode  -> passes context through unchanged
 * - expressionNode -> evaluates each expression, produces a new object
 * - outputNode -> terminal, returns whatever it received
 *
 * decisionTableNode / switchNode / functionNode will throw a clear error —
 * playground is a taste, not a full runtime. Wire up the FastAPI backend
 * for the full engine.
 */

type WasmModule = {
  default: (input?: unknown) => Promise<unknown>;
  evaluateExpression: (expression: string, context: unknown) => unknown;
};

let initPromise: Promise<WasmModule> | null = null;

async function loadWasm(): Promise<WasmModule> {
  if (!initPromise) {
    initPromise = (async () => {
      const mod = (await import("@gorules/zen-engine-wasm")) as unknown as WasmModule;
      await mod.default();
      return mod;
    })();
  }
  return initPromise;
}

interface JdmNode {
  id: string;
  type: string;
  name?: string;
  content?: {
    expressions?: Array<{ id?: string; key: string; value: string }>;
    [k: string]: unknown;
  };
}

interface JdmEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

interface JdmGraph {
  nodes: JdmNode[];
  edges: JdmEdge[];
}

interface TraceEntry {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  performance: string;
  traceData?: unknown;
}

export interface JdmEvaluationResult {
  result: unknown;
  trace: Record<string, TraceEntry>;
  performance: string;
}

export async function evaluateJdm(
  graph: unknown,
  context: Record<string, unknown>,
): Promise<JdmEvaluationResult> {
  const { evaluateExpression } = await loadWasm();

  const g = graph as JdmGraph;
  const nodesById = new Map(g.nodes.map((n) => [n.id, n]));

  const outgoing = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!outgoing.has(e.sourceId)) outgoing.set(e.sourceId, []);
    outgoing.get(e.sourceId)!.push(e.targetId);
  }

  const inputNode = g.nodes.find((n) => n.type === "inputNode");
  if (!inputNode) throw new Error("Graph has no inputNode.");
  const outputNode = g.nodes.find((n) => n.type === "outputNode");
  if (!outputNode) throw new Error("Graph has no outputNode.");

  const trace: Record<string, TraceEntry> = {};
  const results = new Map<string, unknown>();
  const visited = new Set<string>();

  const startTotal = performance.now();

  const walk = (nodeId: string, incoming: Record<string, unknown>): unknown => {
    if (visited.has(nodeId)) {
      return results.get(nodeId);
    }
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) return incoming;

    const nodeStart = performance.now();
    let output: unknown = incoming;

    switch (node.type) {
      case "inputNode":
      case "outputNode":
        output = incoming;
        break;

      case "expressionNode": {
        const expressions = node.content?.expressions ?? [];
        const next: Record<string, unknown> = {};
        for (const expr of expressions) {
          if (!expr.key) continue;
          try {
            next[expr.key] = evaluateExpression(expr.value, incoming);
          } catch (exc) {
            throw new Error(
              `${labelOf(node)}: expression \`${expr.value}\` failed — ${
                exc instanceof Error ? exc.message : String(exc)
              }`,
            );
          }
        }
        output = next;
        break;
      }

      default:
        throw new Error(
          `${labelOf(node)}: node kind "${node.type}" is not supported in the browser playground yet. Run the full engine via the FastAPI backend for tables, switches, and functions.`,
        );
    }

    const nodeMs = performance.now() - nodeStart;
    trace[node.id] = {
      id: node.id,
      name: node.name ?? node.type,
      input: incoming,
      output,
      performance: `${nodeMs.toFixed(2)}ms`,
    };
    results.set(node.id, output);

    for (const nextId of outgoing.get(nodeId) ?? []) {
      walk(nextId, output as Record<string, unknown>);
    }

    return output;
  };

  walk(inputNode.id, context);

  const outputResult =
    results.get(outputNode.id) ??
    (Array.from(results.values()).pop() ?? context);

  return {
    result: outputResult,
    trace,
    performance: `${(performance.now() - startTotal).toFixed(2)}ms`,
  };
}

function labelOf(node: JdmNode) {
  return node.name ? `Node "${node.name}"` : `Node ${node.id}`;
}
