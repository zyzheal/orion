package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/alert-silence/fatigue"
)

// mockFatSvc implements FatigueServiceInterface for testing.
type mockFatSvc struct {
	score  map[string]fatigue.FatigueInfo
	rule   *fatigue.FatigueInfo
	rules  []string
	records []string
	err    error
}

func (m *mockFatSvc) RecordFatigueAlert(_ context.Context, tenantID uuid.UUID, ruleName, severity string) {
	m.records = append(m.records, "alert:"+tenantID.String()+":"+ruleName+":"+severity)
}
func (m *mockFatSvc) RecordFatigueSilenced(_ context.Context, tenantID uuid.UUID, ruleName, severity string) {
	m.records = append(m.records, "silenced:"+tenantID.String()+":"+ruleName+":"+severity)
}
func (m *mockFatSvc) GetFatigueScore(_ context.Context, tenantID uuid.UUID) (map[string]fatigue.FatigueInfo, error) {
	return m.score, m.err
}
func (m *mockFatSvc) GetRuleFatigue(_ context.Context, tenantID uuid.UUID, ruleName string) (*fatigue.FatigueInfo, error) {
	if m.rule == nil {
		return nil, m.err
	}
	return m.rule, m.err
}
func (m *mockFatSvc) AutoSilenceRecommendations(_ context.Context, tenantID uuid.UUID) ([]string, error) {
	return m.rules, m.err
}

// newTestEngine creates a gin engine with the handler wired in, with
// auth middleware disabled (tenantId set via a pass-through middleware).
func newTestEngine(fatSvc FatigueServiceInterface) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Inject tenantId into the gin context, bypassing auth middleware.
	r.Use(func(c *gin.Context) {
		c.Set("tenantId", "00000000-0000-0000-0000-000000000001")
		c.Set("role", "super_admin")
		c.Next()
	})
	grp := r.Group("/api")
	NewAlertSilenceHandler(nil, fatSvc).RegisterRoutes(grp)
	return r
}

// testHTTP sends a request to the gin engine and asserts the expected status.
func testHTTP(t *testing.T, method, path string, body interface{}, fatSvc FatigueServiceInterface, expect int) *httptest.ResponseRecorder {
	t.Helper()
	r := newTestEngine(fatSvc)

	var reader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)
	if resp.Code != expect {
		t.Fatalf("status = %d, want %d; body=%s", resp.Code, expect, resp.Body.String())
	}
	return resp
}

// --- FatigueScore tests ---

func TestFatigueScore_OK(t *testing.T) {
	m := &mockFatSvc{score: map[string]fatigue.FatigueInfo{
		"cpu-high": {RuleName: "cpu-high", Score: 25, Recommendation: "add to silence list"},
	}}
	resp := testHTTP(t, "GET", "/api/alert-fatigue", nil, m, http.StatusOK)
	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)
	if _, ok := body["rules"]; !ok {
		t.Error("expected 'rules' key in response")
	}
}

func TestFatigueScore_NotAvailable(t *testing.T) {
	testHTTP(t, "GET", "/api/alert-fatigue", nil, nil, http.StatusBadRequest)
}

// --- RuleFatigue tests ---

func TestRuleFatigue_OK(t *testing.T) {
	info := &fatigue.FatigueInfo{RuleName: "mem-leak", Score: 15, Recommendation: "monitor"}
	m := &mockFatSvc{rule: info}
	resp := testHTTP(t, "GET", "/api/alert-fatigue/mem-leak", nil, m, http.StatusOK)
	var result fatigue.FatigueInfo
	json.NewDecoder(resp.Body).Decode(&result)
	if result.RuleName != "mem-leak" {
		t.Errorf("RuleName = %s, want mem-leak", result.RuleName)
	}
}

func TestRuleFatigue_NotFound(t *testing.T) {
	m := &mockFatSvc{rule: nil, err: fmt.Errorf("rule not found")}
	testHTTP(t, "GET", "/api/alert-fatigue/nonexistent", nil, m, http.StatusNotFound)
}

// --- AutoSilenceRecommendations tests ---

func TestAutoSilenceRecommendations_OK(t *testing.T) {
	m := &mockFatSvc{rules: []string{"rule-a", "rule-b"}}
	resp := testHTTP(t, "GET", "/api/alert-fatigue/recommendations", nil, m, http.StatusOK)
	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)
	recs := body["recommended_rules"].([]interface{})
	if len(recs) != 2 {
		t.Errorf("got %d recommendations, want 2", len(recs))
	}
}

// --- RecordAlert tests ---

func TestRecordAlert_OK(t *testing.T) {
	m := &mockFatSvc{}
	testHTTP(t, "POST", "/api/alert-fatigue/record", map[string]interface{}{
		"rule_name": "cpu-high",
		"severity":  "critical",
	}, m, http.StatusAccepted)
	if len(m.records) != 1 {
		t.Errorf("expected 1 record, got %d", len(m.records))
	}
	if m.records[0] != "alert:00000000-0000-0000-0000-000000000001:cpu-high:critical" {
		t.Errorf("record = %s", m.records[0])
	}
}

func TestRecordAlert_Silenced(t *testing.T) {
	m := &mockFatSvc{}
	testHTTP(t, "POST", "/api/alert-fatigue/record", map[string]interface{}{
		"rule_name": "mem-leak",
		"silenced":  true,
	}, m, http.StatusAccepted)
	if m.records[0] != "silenced:00000000-0000-0000-0000-000000000001:mem-leak:" {
		t.Errorf("expected silenced record, got %s", m.records[0])
	}
}

func TestRecordAlert_BadRequest(t *testing.T) {
	m := &mockFatSvc{}
	testHTTP(t, "POST", "/api/alert-fatigue/record", map[string]interface{}{}, m, http.StatusBadRequest)
}

func TestRecordAlert_NotAvailable(t *testing.T) {
	testHTTP(t, "POST", "/api/alert-fatigue/record", nil, nil, http.StatusBadRequest)
}

// Compile-time assertion
var _ FatigueServiceInterface = (*mockFatSvc)(nil)
