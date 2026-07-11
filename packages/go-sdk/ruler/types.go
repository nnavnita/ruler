// Package ruler is the Go SDK for the Ruler rule engine.
//
// This package speaks HTTP to the Ruler reference service (demo-api or any
// compatible implementation). A native embedded engine option (via
// github.com/gorules/zen-go) is planned; requires cgo and is not shipped
// in this version.
package ruler

import (
	"encoding/json"
	"time"
)

// RuleStatus mirrors the server-side enum.
type RuleStatus string

const (
	StatusDraft     RuleStatus = "draft"
	StatusReview    RuleStatus = "review"
	StatusPublished RuleStatus = "published"
	StatusArchived  RuleStatus = "archived"
)

// StatusTransition is one of submit/approve/reject/publish/archive.
type StatusTransition string

const (
	Submit  StatusTransition = "submit"
	Approve StatusTransition = "approve"
	Reject  StatusTransition = "reject"
	Publish StatusTransition = "publish"
	Archive StatusTransition = "archive"
)

// JdmContent is an opaque decision-graph payload (JDM JSON).
type JdmContent = map[string]any

// RuleRecord is the legacy "current version of this rule" view.
type RuleRecord struct {
	Name      string     `json:"name"`
	Content   JdmContent `json:"content"`
	Version   int        `json:"version"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// RuleVersion is one immutable snapshot with status metadata.
type RuleVersion struct {
	RuleName        string     `json:"rule_name"`
	Version         int        `json:"version"`
	Content         JdmContent `json:"content"`
	Status          RuleStatus `json:"status"`
	Author          *string    `json:"author"`
	Notes           *string    `json:"notes"`
	CreatedAt       time.Time  `json:"created_at"`
	SubmittedAt     *time.Time `json:"submitted_at"`
	ReviewedAt      *time.Time `json:"reviewed_at"`
	ReviewedBy      *string    `json:"reviewed_by"`
	ReviewDecision  *string    `json:"review_decision"`
	ReviewComment   *string    `json:"review_comment"`
	PublishedAt     *time.Time `json:"published_at"`
}

// RuleTest is a declared test case.
type RuleTest struct {
	ID        string         `json:"id"`
	RuleName  string         `json:"rule_name"`
	Name      string         `json:"name"`
	Input     map[string]any `json:"input"`
	Expected  json.RawMessage `json:"expected"`
	Tags      []string       `json:"tags"`
	CreatedAt time.Time      `json:"created_at"`
}

// RuleTestResult is one run of a RuleTest.
type RuleTestResult struct {
	TestID      string          `json:"test_id"`
	TestName    string          `json:"test_name"`
	RuleName    string          `json:"rule_name"`
	RuleVersion int             `json:"rule_version"`
	Passed      bool            `json:"passed"`
	Expected    json.RawMessage `json:"expected"`
	Actual      json.RawMessage `json:"actual"`
	Error       *string         `json:"error"`
	Performance *string         `json:"performance"`
}

// ReplayEntry is one entry in a replay run.
type ReplayEntry struct {
	Input       map[string]any            `json:"input"`
	Result      json.RawMessage           `json:"result"`
	Trace       map[string]json.RawMessage `json:"trace"`
	Performance *string                   `json:"performance"`
	Error       *string                   `json:"error"`
}

// EvaluationResponse is the shape returned by /evaluate.
type EvaluationResponse struct {
	Result      json.RawMessage            `json:"result"`
	Trace       map[string]json.RawMessage `json:"trace"`
	Performance *string                    `json:"performance"`
	RuleVersion int                        `json:"rule_version"`
}

// AuditRecord is one entry in the execution log.
type AuditRecord struct {
	ID           string                     `json:"id"`
	RuleName     string                     `json:"rule_name"`
	RuleVersion  int                        `json:"rule_version"`
	RuleSnapshot JdmContent                 `json:"rule_snapshot"`
	Input        map[string]any             `json:"input"`
	Result       json.RawMessage            `json:"result"`
	Trace        map[string]json.RawMessage `json:"trace"`
	Performance  *string                    `json:"performance"`
	Error        *string                    `json:"error"`
	CreatedAt    time.Time                  `json:"created_at"`
}

// SaveTestPayload is what the client passes to SaveTest.
type SaveTestPayload struct {
	ID       string          `json:"id,omitempty"`
	Name     string          `json:"name"`
	Input    map[string]any  `json:"input"`
	Expected any             `json:"expected"`
	Tags     []string        `json:"tags,omitempty"`
}
