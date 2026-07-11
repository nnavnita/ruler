import { createRulerClient } from "@ruler/react-editor";

const baseUrl = import.meta.env.VITE_RULER_API_URL ?? "";

export const rulerClient = createRulerClient({ baseUrl });
