import type { JdmContent } from "ruler-editor";

/**
 * Sample "loyalty discount" rule shown in the playground on first load.
 * One expression node computes `discount` and passes the input through.
 */
export const starterGraph: JdmContent = {
  nodes: [
    {
      id: "input-1",
      type: "inputNode",
      name: "input",
      position: { x: 40, y: 160 },
      content: {},
    },
    {
      id: "expr-1",
      type: "expressionNode",
      name: "loyalty discount",
      position: { x: 300, y: 160 },
      content: {
        expressions: [
          {
            id: "e1",
            key: "discount",
            value:
              "tier == 'gold' ? 0.20 : tier == 'silver' ? 0.10 : age >= 60 ? 0.05 : 0",
          },
          { id: "e2", key: "tier", value: "tier" },
          { id: "e3", key: "age", value: "age" },
        ],
      },
    },
    {
      id: "output-1",
      type: "outputNode",
      name: "output",
      position: { x: 620, y: 160 },
      content: {},
    },
  ],
  edges: [
    { id: "edge-1", sourceId: "input-1", targetId: "expr-1", type: "edge" },
    { id: "edge-2", sourceId: "expr-1", targetId: "output-1", type: "edge" },
  ],
};

export const starterInput = `{
  "age": 34,
  "tier": "gold"
}`;
