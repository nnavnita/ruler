"""Ruler engine: framework-agnostic rule engine wrapping GoRules Zen."""

from ruler_engine.audit import (
    AuditRecord,
    AuditSink,
    FileAuditSink,
    InMemoryAuditSink,
)
from ruler_engine.engine import EvaluationOutcome, RuleEngine, RuleNotFoundError
from ruler_engine.schemas import RuleRecord
from ruler_engine.storage import FileStorage, InMemoryStorage, RuleStorage

__all__ = [
    "AuditRecord",
    "AuditSink",
    "EvaluationOutcome",
    "FileAuditSink",
    "FileStorage",
    "InMemoryAuditSink",
    "InMemoryStorage",
    "RuleEngine",
    "RuleNotFoundError",
    "RuleRecord",
    "RuleStorage",
]

__version__ = "0.1.0"
