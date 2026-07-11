# ruler-editor

Drop-in React components for the Ruler rule engine. Wraps `@gorules/jdm-editor` with a trace overlay + audit history + a typed HTTP client.

```bash
pnpm add ruler-editor react react-dom
```

```tsx
import {
  DecisionGraphEditor,
  LogsViewer,
  createRulerClient,
} from "ruler-editor";

const client = createRulerClient({ baseUrl: "http://localhost:8000" });

function App() {
  const [content, setContent] = useState({ nodes: [], edges: [] });
  const [trace, setTrace] = useState(null);

  return (
    <div style={{ height: "100vh" }}>
      <DecisionGraphEditor value={content} onChange={setContent} trace={trace} />
      <LogsViewer client={client} />
    </div>
  );
}
```

Peer deps: `react >= 18`, `react-dom >= 18`. Pairs with `ruler-python-sdk` (embedded) or the `demo-api` FastAPI reference server (any SDK).
