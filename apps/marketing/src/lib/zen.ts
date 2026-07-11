/**
 * Client-side zen-engine bridge. WASM is fetched + initialised once,
 * memoised behind `getZenEngine`.
 *
 * The `@gorules/zen-engine-wasm` module exports a default `init` function
 * plus a `ZenEngine` class. We call init once with the wasm URL, then reuse
 * one engine instance across evaluations.
 */

type ZenEvaluateResult = {
  result: unknown;
  performance?: string;
  trace?: Record<string, unknown>;
};

type ZenDecision = {
  evaluate: (
    context: Record<string, unknown>,
    opts?: { trace?: boolean },
  ) => Promise<ZenEvaluateResult>;
};

type ZenEngineLike = {
  createDecision: (content: unknown) => ZenDecision;
};

let enginePromise: Promise<ZenEngineLike> | null = null;

async function loadEngine(): Promise<ZenEngineLike> {
  const mod: any = await import("@gorules/zen-engine-wasm");
  if (typeof mod.default === "function") {
    await mod.default();
  } else if (typeof mod.init === "function") {
    await mod.init();
  }
  const ZenEngine = mod.ZenEngine ?? mod.default?.ZenEngine;
  if (!ZenEngine) {
    throw new Error("Could not resolve ZenEngine constructor from wasm module");
  }
  return new ZenEngine();
}

export function getZenEngine(): Promise<ZenEngineLike> {
  if (!enginePromise) enginePromise = loadEngine();
  return enginePromise;
}

export async function evaluateJdm(
  content: unknown,
  context: Record<string, unknown>,
): Promise<ZenEvaluateResult> {
  const engine = await getZenEngine();
  const decision = engine.createDecision(content);
  return decision.evaluate(context, { trace: true });
}
