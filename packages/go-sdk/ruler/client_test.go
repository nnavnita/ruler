package ruler_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nnavnita/ruler/packages/go-sdk/ruler"
)

// mockServer stands in for a real Ruler backend. Each entry maps
// "METHOD path" to a canned response.
type mockServer struct {
	t          *testing.T
	responses  map[string]string
	statusCode map[string]int
	requests   []loggedRequest
}

type loggedRequest struct {
	Method string
	Path   string
	Body   string
}

func newMock(t *testing.T) (*mockServer, *httptest.Server) {
	m := &mockServer{
		t:          t,
		responses:  map[string]string{},
		statusCode: map[string]int{},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		m.requests = append(m.requests, loggedRequest{
			Method: r.Method,
			Path:   r.URL.RequestURI(),
			Body:   string(body),
		})
		key := r.Method + " " + r.URL.Path
		if code, ok := m.statusCode[key]; ok {
			w.WriteHeader(code)
		}
		if resp, ok := m.responses[key]; ok {
			_, _ = w.Write([]byte(resp))
		}
	}))
	return m, srv
}

func (m *mockServer) reply(method, path, body string) {
	m.responses[method+" "+path] = body
}

func TestClient_ListRules(t *testing.T) {
	m, srv := newMock(t)
	defer srv.Close()
	m.reply("GET", "/api/rules", `[{"name":"fruit","content":{},"version":1,"updated_at":"2026-01-01T00:00:00Z"}]`)

	c := ruler.NewClient(srv.URL)
	rules, err := c.ListRules(context.Background())
	if err != nil {
		t.Fatalf("ListRules: %v", err)
	}
	if len(rules) != 1 || rules[0].Name != "fruit" {
		t.Fatalf("unexpected rules payload: %+v", rules)
	}
}

func TestClient_SaveRule_SendsContentInBody(t *testing.T) {
	m, srv := newMock(t)
	defer srv.Close()
	m.reply("POST", "/api/rules/fruit", `{"name":"fruit","content":{"foo":1},"version":1,"updated_at":"2026-01-01T00:00:00Z"}`)

	c := ruler.NewClient(srv.URL)
	_, err := c.SaveRule(context.Background(), "fruit", map[string]any{"foo": 1})
	if err != nil {
		t.Fatalf("SaveRule: %v", err)
	}

	req := m.requests[len(m.requests)-1]
	var body map[string]any
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		t.Fatalf("body not JSON: %v", err)
	}
	content, ok := body["content"].(map[string]any)
	if !ok || content["foo"] == nil {
		t.Fatalf("expected content.foo in body, got %+v", body)
	}
}

func TestClient_Evaluate_TargetsSpecificVersion(t *testing.T) {
	m, srv := newMock(t)
	defer srv.Close()
	m.reply("POST", "/api/rules/fruit/evaluate", `{"result":{"label":"apple"},"trace":null,"performance":"312µs","rule_version":3}`)

	c := ruler.NewClient(srv.URL)
	v := 3
	resp, err := c.Evaluate(
		context.Background(),
		"fruit",
		map[string]any{"fruit": "apple"},
		&ruler.EvaluateOptions{Version: &v},
	)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if resp.RuleVersion != 3 {
		t.Fatalf("expected rule_version=3, got %d", resp.RuleVersion)
	}

	req := m.requests[len(m.requests)-1]
	if !strings.Contains(req.Path, "version=3") {
		t.Fatalf("expected ?version=3 in path, got %s", req.Path)
	}
}

func TestClient_TransitionVersion_SendsAction(t *testing.T) {
	m, srv := newMock(t)
	defer srv.Close()
	m.reply("POST", "/api/rules/fruit/versions/1/transition", `{"rule_name":"fruit","version":1,"content":{},"status":"published","author":null,"notes":null,"created_at":"2026-01-01T00:00:00Z","submitted_at":null,"reviewed_at":null,"reviewed_by":null,"review_decision":null,"review_comment":null,"published_at":"2026-01-01T00:00:00Z"}`)

	c := ruler.NewClient(srv.URL)
	v, err := c.TransitionVersion(context.Background(), "fruit", 1, ruler.Publish, nil)
	if err != nil {
		t.Fatalf("TransitionVersion: %v", err)
	}
	if v.Status != ruler.StatusPublished {
		t.Fatalf("expected status=published, got %s", v.Status)
	}

	req := m.requests[len(m.requests)-1]
	var body map[string]any
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		t.Fatalf("body not JSON: %v", err)
	}
	if body["action"] != "publish" {
		t.Fatalf("expected action=publish, got %v", body["action"])
	}
}

func TestClient_NonOKStatusReturnsAPIError(t *testing.T) {
	m, srv := newMock(t)
	defer srv.Close()
	m.statusCode["GET /api/rules/missing"] = http.StatusNotFound
	m.reply("GET", "/api/rules/missing", `{"detail":"Rule 'missing' not found"}`)

	c := ruler.NewClient(srv.URL)
	_, err := c.GetRule(context.Background(), "missing")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var apiErr *ruler.APIError
	if !errorAs(err, &apiErr) {
		t.Fatalf("expected APIError, got %T (%v)", err, err)
	}
	if apiErr.Status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", apiErr.Status)
	}
}

// tiny errors.As shim so we don't pull in extra packages
func errorAs(err error, target any) bool {
	switch t := target.(type) {
	case **ruler.APIError:
		e, ok := err.(*ruler.APIError)
		if !ok {
			return false
		}
		*t = e
		return true
	}
	return false
}
