package ruler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Client is a Ruler HTTP client. Zero value is not usable; use NewClient.
type Client struct {
	baseURL string
	http    *http.Client
	headers map[string]string
}

// Option configures a Client.
type Option func(*Client)

// WithHTTPClient overrides the default *http.Client.
func WithHTTPClient(h *http.Client) Option {
	return func(c *Client) { c.http = h }
}

// WithHeader adds a request header (e.g. Authorization).
func WithHeader(k, v string) Option {
	return func(c *Client) { c.headers[k] = v }
}

// NewClient constructs a Client for the given Ruler service base URL.
func NewClient(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    http.DefaultClient,
		headers: map[string]string{},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// -------------------------- Legacy rule surface -------------------------- //

func (c *Client) ListRules(ctx context.Context) ([]RuleRecord, error) {
	var out []RuleRecord
	err := c.do(ctx, http.MethodGet, "/api/rules", nil, &out)
	return out, err
}

func (c *Client) GetRule(ctx context.Context, name string) (*RuleRecord, error) {
	var out RuleRecord
	err := c.do(ctx, http.MethodGet, "/api/rules/"+url.PathEscape(name), nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SaveRule(ctx context.Context, name string, content JdmContent) (*RuleRecord, error) {
	var out RuleRecord
	err := c.do(ctx, http.MethodPost, "/api/rules/"+url.PathEscape(name),
		map[string]any{"content": content}, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) DeleteRule(ctx context.Context, name string) (bool, error) {
	var out struct {
		Deleted bool `json:"deleted"`
	}
	err := c.do(ctx, http.MethodDelete, "/api/rules/"+url.PathEscape(name), nil, &out)
	return out.Deleted, err
}

// EvaluateOptions tunes an evaluate call.
type EvaluateOptions struct {
	Version *int
}

func (c *Client) Evaluate(
	ctx context.Context,
	name string,
	input map[string]any,
	opts *EvaluateOptions,
) (*EvaluationResponse, error) {
	path := "/api/rules/" + url.PathEscape(name) + "/evaluate"
	if opts != nil && opts.Version != nil {
		path += "?version=" + strconv.Itoa(*opts.Version)
	}
	var out EvaluationResponse
	err := c.do(ctx, http.MethodPost, path, map[string]any{"input": input}, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// ------------------------------- Versions ------------------------------- //

func (c *Client) ListVersions(ctx context.Context, name string) ([]RuleVersion, error) {
	var out []RuleVersion
	err := c.do(ctx, http.MethodGet, "/api/rules/"+url.PathEscape(name)+"/versions", nil, &out)
	return out, err
}

func (c *Client) GetVersion(ctx context.Context, name string, version int) (*RuleVersion, error) {
	var out RuleVersion
	err := c.do(ctx, http.MethodGet,
		fmt.Sprintf("/api/rules/%s/versions/%d", url.PathEscape(name), version), nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateDraftOptions carries optional metadata for a new draft.
type CreateDraftOptions struct {
	Author string
	Notes  string
}

func (c *Client) CreateDraft(
	ctx context.Context,
	name string,
	content JdmContent,
	opts *CreateDraftOptions,
) (*RuleVersion, error) {
	body := map[string]any{"content": content}
	if opts != nil {
		if opts.Author != "" {
			body["author"] = opts.Author
		}
		if opts.Notes != "" {
			body["notes"] = opts.Notes
		}
	}
	var out RuleVersion
	err := c.do(ctx, http.MethodPost,
		"/api/rules/"+url.PathEscape(name)+"/versions", body, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// TransitionOptions carries reviewer metadata for status transitions.
type TransitionOptions struct {
	Reviewer string
	Comment  string
}

func (c *Client) TransitionVersion(
	ctx context.Context,
	name string,
	version int,
	action StatusTransition,
	opts *TransitionOptions,
) (*RuleVersion, error) {
	body := map[string]any{"action": action}
	if opts != nil {
		if opts.Reviewer != "" {
			body["reviewer"] = opts.Reviewer
		}
		if opts.Comment != "" {
			body["comment"] = opts.Comment
		}
	}
	var out RuleVersion
	err := c.do(ctx, http.MethodPost,
		fmt.Sprintf("/api/rules/%s/versions/%d/transition", url.PathEscape(name), version),
		body, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// -------------------------------- Replay -------------------------------- //

func (c *Client) Replay(
	ctx context.Context,
	name string,
	version int,
	inputs []map[string]any,
) ([]ReplayEntry, error) {
	var out []ReplayEntry
	err := c.do(ctx, http.MethodPost,
		fmt.Sprintf("/api/rules/%s/versions/%d/replay", url.PathEscape(name), version),
		map[string]any{"inputs": inputs}, &out)
	return out, err
}

func (c *Client) ReplayHistory(
	ctx context.Context,
	name string,
	version int,
	limit int,
) ([]ReplayEntry, error) {
	var out []ReplayEntry
	err := c.do(ctx, http.MethodPost,
		fmt.Sprintf("/api/rules/%s/versions/%d/replay-history", url.PathEscape(name), version),
		map[string]any{"limit": limit}, &out)
	return out, err
}

// -------------------------------- Tests --------------------------------- //

func (c *Client) ListTests(ctx context.Context, name string) ([]RuleTest, error) {
	var out []RuleTest
	err := c.do(ctx, http.MethodGet, "/api/rules/"+url.PathEscape(name)+"/tests", nil, &out)
	return out, err
}

func (c *Client) SaveTest(
	ctx context.Context, name string, test SaveTestPayload,
) (*RuleTest, error) {
	var out RuleTest
	err := c.do(ctx, http.MethodPost,
		"/api/rules/"+url.PathEscape(name)+"/tests", test, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) DeleteTest(ctx context.Context, name, testID string) (bool, error) {
	var out struct {
		Deleted bool `json:"deleted"`
	}
	err := c.do(ctx, http.MethodDelete,
		fmt.Sprintf("/api/rules/%s/tests/%s",
			url.PathEscape(name), url.PathEscape(testID)), nil, &out)
	return out.Deleted, err
}

// RunTestsOptions optionally targets a specific version.
type RunTestsOptions struct {
	Version *int
}

func (c *Client) RunTests(
	ctx context.Context, name string, opts *RunTestsOptions,
) ([]RuleTestResult, error) {
	body := map[string]any{}
	if opts != nil && opts.Version != nil {
		body["version"] = *opts.Version
	}
	var out []RuleTestResult
	err := c.do(ctx, http.MethodPost,
		"/api/rules/"+url.PathEscape(name)+"/tests/run", body, &out)
	return out, err
}

// --------------------------------- Logs --------------------------------- //

// ListLogsOptions filters/paginates audit log lookups.
type ListLogsOptions struct {
	Limit    int
	RuleName string
}

func (c *Client) ListLogs(
	ctx context.Context, opts *ListLogsOptions,
) ([]AuditRecord, error) {
	path := "/api/logs"
	if opts != nil {
		q := url.Values{}
		if opts.Limit > 0 {
			q.Set("limit", strconv.Itoa(opts.Limit))
		}
		if opts.RuleName != "" {
			q.Set("rule_name", opts.RuleName)
		}
		if enc := q.Encode(); enc != "" {
			path += "?" + enc
		}
	}
	var out []AuditRecord
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out, err
}

func (c *Client) GetLog(ctx context.Context, id string) (*AuditRecord, error) {
	var out AuditRecord
	err := c.do(ctx, http.MethodGet, "/api/logs/"+url.PathEscape(id), nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// --------------------------------- Core --------------------------------- //

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		reader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(resp.Body)
		return &APIError{
			Status: resp.StatusCode,
			Path:   path,
			Body:   string(msg),
		}
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
