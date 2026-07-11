"""Version status flow: draft -> review -> approved -> published."""

from __future__ import annotations

import pytest

from ruler import (
    InMemoryAuditSink,
    InMemoryStorage,
    InMemoryTestStore,
    InvalidStatusTransitionError,
    RuleEngine,
    RuleStatus,
)

from .rules import PASSTHROUGH


def _engine() -> RuleEngine:
    storage = InMemoryStorage()
    return RuleEngine(
        storage=storage,
        audit=InMemoryAuditSink(),
        versions=storage.versions,
        tests=InMemoryTestStore(),
    )


def test_create_draft_starts_in_draft_status():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH, author="me")
    assert v.status == RuleStatus.DRAFT
    assert v.author == "me"
    assert v.published_at is None


def test_full_review_lifecycle():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH)

    submitted = e.submit_for_review("fruit", v.version)
    assert submitted.status == RuleStatus.REVIEW
    assert submitted.submitted_at is not None

    approved = e.approve("fruit", v.version, reviewer="alice", comment="lgtm")
    assert approved.review_decision == "approved"
    assert approved.reviewed_by == "alice"

    published = e.publish("fruit", v.version)
    assert published.status == RuleStatus.PUBLISHED
    assert published.published_at is not None


def test_publish_second_version_archives_previous():
    e = _engine()
    v1 = e.create_draft("fruit", PASSTHROUGH)
    e.submit_for_review("fruit", v1.version)
    e.approve("fruit", v1.version, reviewer="alice")
    e.publish("fruit", v1.version)

    v2 = e.create_draft("fruit", PASSTHROUGH)
    e.publish("fruit", v2.version)  # publish direct from draft

    v1_after = e.get_version("fruit", v1.version)
    v2_after = e.get_version("fruit", v2.version)
    assert v1_after.status == RuleStatus.ARCHIVED
    assert v2_after.status == RuleStatus.PUBLISHED


def test_reject_moves_back_to_draft():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH)
    e.submit_for_review("fruit", v.version)

    rejected = e.reject("fruit", v.version, reviewer="alice", comment="try again")
    assert rejected.status == RuleStatus.DRAFT
    assert rejected.review_decision == "rejected"
    assert rejected.review_comment == "try again"


def test_cannot_approve_a_draft():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH)
    with pytest.raises(InvalidStatusTransitionError):
        e.approve("fruit", v.version)


def test_cannot_publish_a_review_without_approval():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH)
    e.submit_for_review("fruit", v.version)
    with pytest.raises(InvalidStatusTransitionError):
        e.publish("fruit", v.version)


def test_cannot_submit_twice():
    e = _engine()
    v = e.create_draft("fruit", PASSTHROUGH)
    e.submit_for_review("fruit", v.version)
    with pytest.raises(InvalidStatusTransitionError):
        e.submit_for_review("fruit", v.version)
