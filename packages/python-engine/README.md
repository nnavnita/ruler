# ruler-engine

Framework-agnostic Python rule engine wrapping [GoRules Zen](https://gorules.io/). Pluggable storage + audit.

```bash
pip install ruler-engine
```

```python
from ruler_engine import RuleEngine, InMemoryStorage, InMemoryAuditSink

engine = RuleEngine(storage=InMemoryStorage(), audit=InMemoryAuditSink())
engine.save_rule("discount", jdm_json_dict)
outcome = engine.evaluate("discount", {"age": 25, "tier": "gold"})
print(outcome.result, outcome.trace, outcome.performance)
```

Storage / audit are protocols — implement your own for Postgres, Redis, S3, whatever.
