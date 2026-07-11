/**
 * Client-side JDM interpreter.
 *
 * `@gorules/zen-engine-wasm` (0.23) only exposes the expression + unary
 * runtime, not a full decision-graph evaluator. So we walk the graph in
 * JS and delegate cell-level work to WASM.
 *
 * Supported node kinds:
 * - inputNode         -> passes context through unchanged
 * - expressionNode    -> evaluates each expression, produces a new object
 * - switchNode        -> first-hit or collect over statements, follows only
 *                        edges whose sourceHandle equals a winning statement
 * - decisionTableNode -> matches rows via unary expressions per input cell,
 *                        emits row outputs (first-hit or collect)
 * - functionNode      -> runs the node's JS `handler({ input })` via
 *                        AsyncFunction — treat this as running your own code
 * - outputNode        -> terminal, returns whatever it received
 *
 * decisionNode (sub-graph invocation) and customNode still throw a clear
 * error. Sub-graph support would need a rule store; run those through the
 * full FastAPI engine.
 */

interface VariableInstance {
  cloneWith(key: string, value: unknown): VariableInstance;
  evaluateExpression(expression: string): unknown;
  evaluateUnaryExpression(expression: string): boolean;
}

type WasmModule = {
  default: (input?: unknown) => Promise<unknown>;
  evaluateExpression: (expression: string, context: unknown) => unknown;
  evaluateUnaryExpression: (expression: string, context: unknown) => boolean;
  Variable: new (value: unknown) => VariableInstance;
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

interface Statement {
  id: string;
  condition?: string;
  isDefault?: boolean;
}

interface TableColumn {
  id: string;
  field?: string;
  name?: string;
}

interface TableRule {
  _id?: string;
  [cellId: string]: unknown;
}

interface JdmNode {
  id: string;
  type: string;
  name?: string;
  content?: {
    expressions?: Array<{ id?: string; key: string; value: string }>;
    statements?: Statement[];
    hitPolicy?: "first" | "collect";
    inputs?: TableColumn[];
    outputs?: TableColumn[];
    rules?: TableRule[];
    source?: string;
    [k: string]: unknown;
  };
}

interface JdmEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
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

// Async Function constructor — needed because functionNode handlers are async.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export async function evaluateJdm(
  graph: unknown,
  context: Record<string, unknown>,
): Promise<JdmEvaluationResult> {
  const wasm = await loadWasm();

  const g = graph as JdmGraph;
  const nodesById = new Map(g.nodes.map((n) => [n.id, n]));

  const inputNode = g.nodes.find((n) => n.type === "inputNode");
  if (!inputNode) throw new Error("Graph has no inputNode.");
  const outputNode = g.nodes.find((n) => n.type === "outputNode");
  if (!outputNode) throw new Error("Graph has no outputNode.");

  const trace: Record<string, TraceEntry> = {};
  const results = new Map<string, unknown>();
  const visited = new Set<string>();

  const startTotal = performance.now();

  const edgesFrom = (nodeId: string, handle?: string): JdmEdge[] =>
    g.edges.filter(
      (e) =>
        e.sourceId === nodeId &&
        (handle === undefined || (e.sourceHandle ?? "") === handle),
    );

  const walk = async (
    nodeId: string,
    incoming: Record<string, unknown>,
  ): Promise<unknown> => {
    if (visited.has(nodeId)) return results.get(nodeId);
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) return incoming;

    const nodeStart = performance.now();
    let output: unknown = incoming;
    let traceData: unknown = undefined;
    let nextEdges: JdmEdge[] = edgesFrom(nodeId);

    switch (node.type) {
      case "inputNode":
      case "outputNode":
        output = incoming;
        break;

      case "expressionNode": {
        output = evaluateExpressionNode(node, incoming, wasm);
        break;
      }

      case "switchNode": {
        const { winners, followEdges } = evaluateSwitchNode(
          node,
          incoming,
          wasm,
          nodeId,
          edgesFrom,
        );
        traceData = { taken: winners.map((w) => w.id) };
        output = incoming;
        nextEdges = followEdges;
        break;
      }

      case "decisionTableNode": {
        const outcome = evaluateDecisionTable(node, incoming, wasm);
        output = outcome.output;
        traceData = { hitRuleIds: outcome.hitRuleIds };
        break;
      }

      case "functionNode": {
        output = await evaluateFunctionNode(node, incoming);
        break;
      }

      case "decisionNode":
        throw new Error(
          `${labelOf(node)}: sub-graph decisionNode isn't supported in the browser playground — it needs a rule store. Run through the full FastAPI engine.`,
        );

      default:
        throw new Error(
          `${labelOf(node)}: node kind "${node.type}" is not supported in the browser playground. Run the full engine for custom nodes.`,
        );
    }

    const nodeMs = performance.now() - nodeStart;
    trace[node.id] = {
      id: node.id,
      name: node.name ?? node.type,
      input: incoming,
      output,
      performance: `${nodeMs.toFixed(2)}ms`,
      traceData,
    };
    results.set(node.id, output);

    for (const e of nextEdges) {
      await walk(e.targetId, output as Record<string, unknown>);
    }

    return output;
  };

  await walk(inputNode.id, context);

  const outputResult =
    results.get(outputNode.id) ??
    (Array.from(results.values()).pop() ?? context);

  return {
    result: outputResult,
    trace,
    performance: `${(performance.now() - startTotal).toFixed(2)}ms`,
  };
}

// -------------------------------------------------------------------------- //
// Per-node evaluators                                                         //
// -------------------------------------------------------------------------- //

function evaluateExpressionNode(
  node: JdmNode,
  incoming: Record<string, unknown>,
  wasm: WasmModule,
): Record<string, unknown> {
  const expressions = node.content?.expressions ?? [];
  const next: Record<string, unknown> = {};
  for (const expr of expressions) {
    if (!expr.key) continue;
    try {
      next[expr.key] = evalExpressionSafe(
        wasm.evaluateExpression,
        expr.value,
        incoming,
      );
    } catch (exc) {
      throw new Error(
        `${labelOf(node)}: expression \`${expr.value}\` failed — ${
          exc instanceof Error ? exc.message : String(exc)
        }`,
      );
    }
  }
  return next;
}

function evaluateSwitchNode(
  node: JdmNode,
  incoming: Record<string, unknown>,
  wasm: WasmModule,
  nodeId: string,
  edgesFrom: (id: string, handle?: string) => JdmEdge[],
): { winners: Statement[]; followEdges: JdmEdge[] } {
  const statements = node.content?.statements ?? [];
  const hitPolicy = node.content?.hitPolicy ?? "first";

  const isFallback = (s: Statement) =>
    s.isDefault === true || !s.condition || s.condition.trim() === "";

  const winners: Statement[] = [];
  for (const s of statements) {
    if (isFallback(s)) continue;
    let matched = false;
    try {
      const raw = wasm.evaluateExpression(s.condition!, incoming);
      matched = raw === true || raw === "true";
    } catch (exc) {
      throw new Error(
        `${labelOf(node)}: statement \`${s.condition}\` failed — ${
          exc instanceof Error ? exc.message : String(exc)
        }`,
      );
    }
    if (matched) {
      winners.push(s);
      if (hitPolicy === "first") break;
    }
  }
  if (winners.length === 0) {
    // Any fallback (explicit isDefault: true OR empty condition) counts.
    const def = statements.find(isFallback);
    if (def) winners.push(def);
  }
  if (winners.length === 0) {
    throw new Error(
      `${labelOf(node)}: no matching statement and no default/fallback branch.`,
    );
  }
  return {
    winners,
    followEdges: winners.flatMap((w) => edgesFrom(nodeId, w.id)),
  };
}

function evaluateDecisionTable(
  node: JdmNode,
  incoming: Record<string, unknown>,
  wasm: WasmModule,
): { output: unknown; hitRuleIds: string[] } {
  const inputs = node.content?.inputs ?? [];
  const outputs = node.content?.outputs ?? [];
  const rules = node.content?.rules ?? [];
  const hitPolicy = node.content?.hitPolicy ?? "first";

  const hitRuleIds: string[] = [];
  const collected: Record<string, unknown>[] = [];

  const baseVar = new wasm.Variable(incoming);

  for (const rule of rules) {
    const cellsMatch = inputs.every((col) => {
      const cell = String((rule[col.id] as unknown) ?? "").trim();
      if (cell === "") return true;
      if (!col.field) return true;
      const value = readField(incoming, col.field);
      try {
        return baseVar.cloneWith("$", value).evaluateUnaryExpression(cell);
      } catch (exc) {
        throw new Error(
          `${labelOf(node)}: rule ${rule._id ?? "?"} column ${col.name ?? col.field} check \`${cell}\` failed — ${
            exc instanceof Error ? exc.message : String(exc)
          }`,
        );
      }
    });

    if (!cellsMatch) continue;

    const rowOutput: Record<string, unknown> = {};
    for (const col of outputs) {
      const cell = String((rule[col.id] as unknown) ?? "").trim();
      if (cell === "") continue;
      const field = col.field ?? col.name ?? col.id;
      try {
        rowOutput[field] = evalExpressionSafe(
          wasm.evaluateExpression,
          cell,
          incoming,
        );
      } catch (exc) {
        throw new Error(
          `${labelOf(node)}: rule ${rule._id ?? "?"} output ${field} \`${cell}\` failed — ${
            exc instanceof Error ? exc.message : String(exc)
          }`,
        );
      }
    }

    hitRuleIds.push(String(rule._id ?? ""));
    collected.push(rowOutput);
    if (hitPolicy === "first") break;
  }

  if (hitPolicy === "collect") {
    return { output: collected, hitRuleIds };
  }
  return { output: collected[0] ?? {}, hitRuleIds };
}

async function evaluateFunctionNode(
  node: JdmNode,
  incoming: Record<string, unknown>,
): Promise<unknown> {
  const rawSource = node.content?.source;
  if (!rawSource) {
    throw new Error(`${labelOf(node)}: functionNode has no source.`);
  }
  const stripped = rawSource.replace(/^\s*export\s+/gm, "");
  const body = `${stripped}\nreturn await handler({ input });`;

  try {
    const fn = new AsyncFunction("input", body);
    return await fn(incoming);
  } catch (exc) {
    throw new Error(
      `${labelOf(node)}: function threw — ${
        exc instanceof Error ? exc.message : String(exc)
      }`,
    );
  }
}

// -------------------------------------------------------------------------- //
// Helpers                                                                     //
// -------------------------------------------------------------------------- //

function readField(ctx: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cursor: unknown = ctx;
  for (const p of parts) {
    if (cursor == null) return undefined;
    cursor = (cursor as Record<string, unknown>)[p];
  }
  return cursor;
}

function labelOf(node: JdmNode) {
  return node.name ? `Node "${node.name}"` : `Node ${node.id}`;
}

/**
 * `@gorules/zen-engine-wasm@0.23` truncates decimal results to integers
 * when marshalling back to JS (0.20 -> 0, 1.5 -> 1). Workaround: wrap the
 * expression in `string(...)`, then parse the string back on our side.
 */
function evalExpressionSafe(
  evaluate: (expr: string, ctx: unknown) => unknown,
  expr: string,
  ctx: unknown,
): unknown {
  const wrapped = `string(${expr})`;
  try {
    const raw = evaluate(wrapped, ctx);
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
      if (trimmed === "null") return null;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const n = Number(trimmed);
        if (!Number.isNaN(n)) return n;
      }
      return raw;
    }
    return raw;
  } catch {
    return evaluate(expr, ctx);
  }
}
