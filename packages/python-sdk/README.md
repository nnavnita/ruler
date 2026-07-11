# ruler-python-sdk

Framework-agnostic Python rule engine + SDK. Wraps [GoRules Zen](https://gorules.io/). Pluggable rule storage, version store, audit sink, and test store — draft → review → publish flow built in.

```bash
pip install ruler-python-sdk
```

```python
from ruler import RuleEngine, InMemoryStorage, InMemoryAuditSink

engine = RuleEngine(storage=InMemoryStorage(), audit=InMemoryAuditSink())
engine.save_rule("discount", jdm_json_dict)
outcome = engine.evaluate("discount", {"age": 25, "tier": "gold"})
print(outcome.result, outcome.trace, outcome.performance)
```

Every store is a `Protocol` — implement your own for Postgres, Redis, S3, whatever. The reference `demo-api` FastAPI service wires the same engine behind an HTTP surface consumed by the Go, Java, and React clients.
