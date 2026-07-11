"""Ruler engine: framework-agnostic rule engine wrapping GoRules Zen."""

from ruler.audit import (
    AuditRecord,
    AuditSink,
    FileAuditSink,
    InMemoryAuditSink,
)
from ruler.engine import (
    EvaluationOutcome,
    InvalidStatusTransitionError,
    ReplayEntry,
    RuleEngine,
    RuleNotFoundError,
    VersionNotFoundError,
)
from ruler.schemas import (
    RuleRecord,
    RuleStatus,
    RuleTest,
    RuleTestResult,
    RuleVersion,
)
from ruler.storage import (
    FileStorage,
    FileTestStore,
    FileVersionStore,
    InMemoryStorage,
    InMemoryTestStore,
    InMemoryVersionStore,
    RuleStorage,
    RuleTestStore,
    RuleVersionStore,
)

__all__ = [
    "AuditRecord",
    "AuditSink",
    "EvaluationOutcome",
    "FileAuditSink",
    "FileStorage",
    "FileTestStore",
    "FileVersionStore",
    "InMemoryAuditSink",
    "InMemoryStorage",
    "InMemoryTestStore",
    "InMemoryVersionStore",
    "InvalidStatusTransitionError",
    "ReplayEntry",
    "RuleEngine",
    "RuleNotFoundError",
    "RuleRecord",
    "RuleStatus",
    "RuleStorage",
    "RuleTest",
    "RuleTestResult",
    "RuleTestStore",
    "RuleVersion",
    "RuleVersionStore",
    "VersionNotFoundError",
]

__version__ = "0.2.0"
