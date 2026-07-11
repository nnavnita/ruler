import { createRulerClient } from "ruler-editor";

const baseUrl = import.meta.env.VITE_RULER_API_URL ?? "";

export const rulerClient = createRulerClient({ baseUrl });
