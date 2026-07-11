"""Engine evaluate() + replay(): actual JDM execution through zen-engine."""

from __future__ import annotations

import pytest

from ruler import (
    InMemoryAuditSink,
    InMemoryStorage,
    InMemoryTestStore,
    RuleEngine,
)

from .rules import FRUIT_CLASSIFIER


@pytest.fixture()
def engine() -> RuleEngine:
    storage = InMemoryStorage()
    e = RuleEngine(
        storage=storage,
        audit=InMemoryAuditSink(),
        versions=storage.versions,
        tests=InMemoryTestStore(),
    )
    e.create_draft("fruit", FRUIT_CLASSIFIER)
    return e


@pytest.mark.parametrize(
    "fruit,expected",
    [
        ("apple", "keeps the doctor away"),
        ("banana", "potassium boost"),
        ("dragonfruit", "unknown fruit"),
    ],
)
def test_evaluate_returns_expected_label(engine: RuleEngine, fruit: str, expected: str):
    outcome = engine.evaluate("fruit", {"fruit": fruit})
    assert outcome.result is not None
    assert outcome.result["label"] == expected


def test_evaluate_records_audit_entry(engine: RuleEngine):
    engine.evaluate("fruit", {"fruit": "apple"})
    engine.evaluate("fruit", {"fruit": "banana"})

    audit = engine.audit  # type: ignore[attr-defined]
    logs = audit.list()  # type: ignore[union-attr]
    assert len(logs) == 2
    fruits = sorted(r.input["fruit"] for r in logs)
    assert fruits == ["apple", "banana"]


def test_replay_evaluates_batch_without_touching_audit(engine: RuleEngine):
    inputs = [
        {"fruit": "apple"},
        {"fruit": "banana"},
        {"fruit": "kiwi"},
    ]
    entries = engine.replay("fruit", version=1, contexts=inputs)

    audit = engine.audit  # type: ignore[attr-defined]
    assert audit is not None
    assert len(entries) == 3
    assert audit.list() == []  # replay must not pollute the audit log
    assert [e.result["label"] for e in entries] == [
        "keeps the doctor away",
        "potassium boost",
        "unknown fruit",
    ]


def test_replay_history_pulls_prior_inputs(engine: RuleEngine):
    engine.evaluate("fruit", {"fruit": "apple"})
    engine.evaluate("fruit", {"fruit": "banana"})

    entries = engine.replay_history("fruit", version=1)
    assert len(entries) == 2
    seen = {e.input["fruit"] for e in entries}
    assert seen == {"apple", "banana"}
