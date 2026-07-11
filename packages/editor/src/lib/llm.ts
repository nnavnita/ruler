/**
 * LLM provider adapters for browser-side rule authoring.
 *
 * Adapters are dumb: they take a config, a prompt, and return the model's
 * text response. Whether the response is valid JDM JSON is the caller's
 * job to validate.
 */

import type { JdmContent } from "../types";
import type { LlmConfig } from "./keyStorage";

const SYSTEM_PROMPT = `You are a business rules author. Convert the user's request into a GoRules JDM decision graph.

Return ONLY a JSON object matching this shape (no prose, no markdown fences):

{
  "nodes": [
    { "id": string, "type": string, "name": string, "position": { "x": number, "y": number }, "content": object }
  ],
  "edges": [
    { "id": string, "sourceId": string, "targetId": string, "type": "edge" }
  ]
}

Supported node types:
- inputNode      (name "input", empty content)
- outputNode     (name "output", empty content)
- expressionNode (content: { "expressions": [{ "id": string, "key": string, "value": string }] })
- decisionTableNode
- switchNode

Expression language: single-quoted strings, "? :" ternary, standard arithmetic/comparison operators.
Every graph MUST include exactly one inputNode and exactly one outputNode.
Wire expressionNodes between them. Positions should form a left-to-right layout.

Existing graph (may be empty — treat as starting point when non-trivial):
{{EXISTING}}

User request:
{{REQUEST}}`;

export interface AuthorResult {
  content: JdmContent;
  raw: string;
}

export async function authorRule(
  config: LlmConfig,
  request: string,
  existing: JdmContent | null,
): Promise<AuthorResult> {
  const prompt = SYSTEM_PROMPT
    .replace("{{EXISTING}}", existing ? JSON.stringify(existing, null, 2) : "(empty)")
    .replace("{{REQUEST}}", request);

  const raw =
    config.provider === "anthropic"
      ? await callAnthropic(config, prompt)
      : await callOpenAi(config, prompt);

  const json = extractJson(raw);
  const content = JSON.parse(json) as JdmContent;
  return { content, raw };
}

async function callAnthropic(config: LlmConfig, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anthropic ${response.status}: ${text || response.statusText}`);
  }
  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (body.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  if (!text) throw new Error("Anthropic returned empty content");
  return text;
}

async function callOpenAi(config: LlmConfig, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI ${response.status}: ${text || response.statusText}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI returned empty content");
  return text;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  // Strip common markdown fences the model might add anyway.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}
