import type { JdmContent } from "@ruler/react-editor";

/** Minimal starter graph so a fresh install renders something. */
export const starterGraph: JdmContent = {
  nodes: [
    {
      id: "input-1",
      type: "inputNode",
      name: "input",
      position: { x: 40, y: 120 },
      content: {},
    },
    {
      id: "output-1",
      type: "outputNode",
      name: "output",
      position: { x: 440, y: 120 },
      content: {},
    },
  ],
  edges: [
    {
      id: "edge-1",
      sourceId: "input-1",
      targetId: "output-1",
      type: "edge",
    },
  ],
};
