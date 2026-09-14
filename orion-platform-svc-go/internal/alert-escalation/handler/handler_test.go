package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"
	"orion/platform-svc-go/internal/alert-escalation/service"

	"github.com/gin-gonic/gin"
)

type mockAlertSvc struct {
	policies map[string]*models.EscalationPolicy
	triggers []models.EscalationTrigger
	closures map[string]*models.AlertClosure

	// forcedError makes every read and update return an error that is neither
	// sql.ErrNoRows nor a validation error, which is the only way to reach the
	// 500 branches of the handlers.
	forcedError     error
	deletePolicyErr error
	closuresList    []models.AlertClosure
}

func newMockAlertSvc() *mockAlertSvc {
	return &mockAlertSvc{
		policies: make(map[string]*models.EscalationPolicy),
		closures: make(map[string]*models.AlertClosure),
	}
}

func (m *mockAlertSvc) CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, operator string) (*models.EscalationPolicy, error) {
	p := &models.EscalationPolicy{ID: "ep-" + req.Name, Name: req.Name, Severity: req.Severity, Status: "active"}
	if p.Severity == "" {
		p.Severity = "all"
	}
	m.policies[p.ID] = p
	return p, nil
}
func (m *mockAlertSvc) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	p, ok := m.policies[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}
func (m *mockAlertSvc) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	var items []models.EscalationPolicy
	for _, p := range m.policies {
		items = append(items, *p)
	}
	if items == nil {
		items = []models.EscalationPolicy{}
	}
	return items, nil
}
func (m *mockAlertSvc) UpdatePolicy(ctx context.Context, id, tenantID string, req *models.UpdatePolicyRequest) (*models.EscalationPolicy, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	p, ok := m.policies[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	return p, nil
}
func (m *mockAlertSvc) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	if m.deletePolicyErr != nil {
		return false, m.deletePolicyErr
	}
	if _, ok := m.policies[id]; !ok {
		return false, nil
	}
	delete(m.policies, id)
	return true, nil
}
func (m *mockAlertSvc) EvaluatePolicy(ctx context.Context, alertID, severity, tenantID string) ([]*models.EscalationTrigger, error) {
	return []*models.EscalationTrigger{{ID: "et-1", PolicyID: "ep-1", AlertID: alertID}}, nil
}
func (m *mockAlertSvc) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	if m.triggers == nil {
		m.triggers = []models.EscalationTrigger{}
	}
	return m.triggers, nil
}
func (m *mockAlertSvc) ResolveTrigger(ctx context.Context, id, tenantID string) (*models.EscalationTrigger, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	return &models.EscalationTrigger{ID: id, Status: "resolved"}, nil
}
func (m *mockAlertSvc) CreateAlertClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	c := &models.AlertClosure{ID: "ac-" + alertID, AlertID: alertID, Status: "open"}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) AcknowledgeAlert(ctx context.Context, alertID, tenantID, operator string) (*models.AlertClosure, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	c := &models.AlertClosure{ID: "ac-" + alertID, AlertID: alertID, Status: "acknowledged", AcknowledgedBy: operator}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) ResolveAlert(ctx context.Context, req *models.ResolveRequest, tenantID string) (*models.AlertClosure, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	c := &models.AlertClosure{ID: "ac-" + req.AlertID, AlertID: req.AlertID, Status: "resolved", ResolvedBy: req.Operator}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	c, ok := m.closures["ac-"+alertID]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return c, nil
}
func (m *mockAlertSvc) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	if m.forcedError != nil {
		return nil, m.forcedError
	}
	if m.closuresList != nil {
		return m.closuresList, nil
	}
	var items []models.AlertClosure
	for _, c := range m.closures {
		if status == "" || c.Status == status {
			items = append(items, *c)
		}
	}
	if items == nil {
		items = []models.AlertClosure{}
	}
	return items, nil
}
func (m *mockAlertSvc) GetMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	return nil, nil
}
func (m *mockAlertSvc) RecordMetric(ctx context.Context, tenantID string, day time.Time, stats map[string]interface{}) error {
	return nil
}

func makeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Set("user_id", "u1")
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Params = gin.Params{{Key: "id", Value: "ep-1"}, {Key: "alertId", Value: "alert-1"}}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func TestAlert_RegisterRoutes(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	r := gin.New()
	rg := &r.RouterGroup
	h.RegisterRoutes(rg)
}

func TestAlert_CreatePolicy(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodPost, "/policies", map[string]interface{}{
		"name":  "sev-pol",
		"rules": []interface{}{map[string]interface{}{"level": 1}},
	})
	h.CreatePolicy(c)
	if w.Code != 201 {
		t.Fatalf("CreatePolicy status = %d, want 201", w.Code)
	}
}

func TestAlert_GetPolicy_NotFound(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodGet, "/policies/:id", nil)
	h.GetPolicy(c)
	if w.Code != 404 {
		t.Fatalf("GetPolicy status = %d, want 404", w.Code)
	}
}

func TestAlert_DeletePolicy(t *testing.T) {
	svc := newMockAlertSvc()
	svc.policies["ep-1"] = &models.EscalationPolicy{ID: "ep-1", Name: "del-me"}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodDelete, "/policies/:id", nil)
	h.DeletePolicy(c)
	if w.Code != 200 {
		t.Fatalf("DeletePolicy status = %d, want 200", w.Code)
	}
}

func TestAlert_EvaluatePolicy(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodPost, "/evaluate", map[string]interface{}{
		"alertId": "alert-1", "severity": "critical",
	})
	h.EvaluatePolicy(c)
	if w.Code != 200 {
		t.Fatalf("EvaluatePolicy status = %d, want 200", w.Code)
	}
}

func TestAlert_AcknowledgeAlert(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodPost, "/acknowledge", map[string]interface{}{
		"alertId": "alert-1", "operator": "oncall",
	})
	h.AcknowledgeAlert(c)
	if w.Code != 200 {
		t.Fatalf("AcknowledgeAlert status = %d, want 200", w.Code)
	}
}

func TestAlert_ResolveAlert(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodPost, "/resolve", map[string]interface{}{
		"alertId": "alert-1", "operator": "fixer", "resolutionNote": "fixed",
	})
	h.ResolveAlert(c)
	if w.Code != 200 {
		t.Fatalf("ResolveAlert status = %d, want 200", w.Code)
	}
}

// readEnvelope pulls the data half of the middleware ResponseEnvelope the
// handlers write, so a test can assert on the payload instead of grepping the
// JSON by hand.
func readEnvelope(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var env struct {
		Success bool                   `json:"success"`
		Data    map[string]interface{} `json:"data"`
		Error   string                 `json:"error"`
	}
	if err := json.Unmarshal([]byte(w.Body.String()), &env); err != nil {
		t.Fatalf("decoding response %q: %v", w.Body.String(), err)
	}
	return env.Data
}

func metricValue(t *testing.T, data map[string]interface{}, key string) float64 {
	t.Helper()
	v, ok := data[key]
	if !ok {
		t.Fatalf("response has no %q key: %v", key, data)
	}
	n, ok := v.(float64)
	if !ok {
		t.Fatalf("%s = %v (%T), want a number", key, v, v)
	}
	return n
}

func TestAlert_UpdatePolicy_EmptyBodyIs400(t *testing.T) {
	// An empty body used to reach Postgres as "UPDATE escalation_policy SET
	//  WHERE ..." and the caller was told the policy did not exist.
	svc := newMockAlertSvc()
	svc.forcedError = service.ErrEmptyUpdate
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/policies/:id", map[string]interface{}{})
	h.UpdatePolicy(c)
	if w.Code != 400 {
		t.Fatalf("UpdatePolicy status = %d, want 400 for an empty body", w.Code)
	}
	// readEnvelope only returns the data half, and an error envelope has none.
	if !strings.Contains(w.Body.String(), "no fields to update") {
		t.Errorf("body %q does not carry the ErrEmptyUpdate text", w.Body.String())
	}
}

func TestAlert_UpdatePolicy_NotFoundIs404(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = sql.ErrNoRows
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/policies/:id", map[string]interface{}{"name": "x"})
	h.UpdatePolicy(c)
	if w.Code != 404 {
		t.Fatalf("UpdatePolicy status = %d, want 404", w.Code)
	}
}

func TestAlert_UpdatePolicy_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("connection refused")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/policies/:id", map[string]interface{}{"name": "x"})
	h.UpdatePolicy(c)
	if w.Code != 500 {
		t.Fatalf("UpdatePolicy status = %d, want 500 for a storage failure", w.Code)
	}
}

func TestAlert_DeletePolicy_StorageErrorIs500(t *testing.T) {
	// A failed DELETE used to be reported as "policy not found", so a database
	// outage looked like an already-deleted policy.
	svc := newMockAlertSvc()
	svc.deletePolicyErr = errors.New("relation escalation_policy does not exist")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodDelete, "/policies/:id", nil)
	h.DeletePolicy(c)
	if w.Code != 500 {
		t.Fatalf("DeletePolicy status = %d, want 500", w.Code)
	}
}

func TestAlert_GetPolicy_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("could not read rules")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/policies/:id", nil)
	h.GetPolicy(c)
	if w.Code != 500 {
		t.Fatalf("GetPolicy status = %d, want 500: a corrupt rules column is a storage problem", w.Code)
	}
}

func TestAlert_GetClosure_NotFoundIs404(t *testing.T) {
	h := NewHandler(newMockAlertSvc())
	c, w := makeCtx(http.MethodGet, "/closures/:alertId", nil)
	h.GetClosure(c)
	if w.Code != 404 {
		t.Fatalf("GetClosure status = %d, want 404", w.Code)
	}
}

func TestAlert_GetClosure_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("deadlock detected")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/closures/:alertId", nil)
	h.GetClosure(c)
	if w.Code != 500 {
		t.Fatalf("GetClosure status = %d, want 500", w.Code)
	}
}

func TestAlert_ListClosures_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("deadlock detected")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/closures", nil)
	h.ListClosures(c)
	if w.Code != 500 {
		t.Fatalf("ListClosures status = %d, want 500", w.Code)
	}
}

func TestAlert_ResolveTrigger_NotFoundIs404(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = sql.ErrNoRows
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/triggers/:id/resolve", nil)
	h.ResolveTrigger(c)
	if w.Code != 404 {
		t.Fatalf("ResolveTrigger status = %d, want 404", w.Code)
	}
}

func TestAlert_ResolveTrigger_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("deadlock detected")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/triggers/:id/resolve", nil)
	h.ResolveTrigger(c)
	if w.Code != 500 {
		t.Fatalf("ResolveTrigger status = %d, want 500", w.Code)
	}
}

func TestAlert_AcknowledgeAlert_StorageErrorIs500(t *testing.T) {
	// Nothing in this path is caller-supplied and invalid, so a 400 here meant a
	// database outage wearing the clothes of a malformed request.
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("connection refused")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPost, "/acknowledge", map[string]interface{}{
		"alertId": "alert-1", "operator": "oncall",
	})
	h.AcknowledgeAlert(c)
	if w.Code != 500 {
		t.Fatalf("AcknowledgeAlert status = %d, want 500", w.Code)
	}
}

func TestAlert_ResolveAlert_StorageErrorIs500(t *testing.T) {
	svc := newMockAlertSvc()
	svc.forcedError = errors.New("connection refused")
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPost, "/resolve", map[string]interface{}{
		"alertId": "alert-1", "operator": "fixer",
	})
	h.ResolveAlert(c)
	if w.Code != 500 {
		t.Fatalf("ResolveAlert status = %d, want 500", w.Code)
	}
}

func TestAlert_GetMetrics_DedupsAndPartitions(t *testing.T) {
	// alert_closure has no unique(alert_id), so one alert can sit in two rows.
	// The list is newest first, so the first row must win. The three lifecycle
	// counters are disjoint buckets of the total, so they must add up.
	now := time.Now()
	svc := newMockAlertSvc()
	svc.closuresList = []models.AlertClosure{
		{ID: "c1", AlertID: "a1", Status: "resolved", AcknowledgedAt: &now, MTTRSeconds: 600},
		{ID: "c2", AlertID: "a1", Status: "acknowledged"},
		{ID: "c3", AlertID: "a2", Status: "open"},
		{ID: "c4", AlertID: "a3", Status: "acknowledged", AcknowledgedAt: &now},
		{ID: "c5", AlertID: "a4", Status: "weird"},
	}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/metrics", nil)
	h.GetMetrics(c)
	if w.Code != 200 {
		t.Fatalf("GetMetrics status = %d, want 200", w.Code)
	}
	data := readEnvelope(t, w)
	if got := metricValue(t, data, "totalAlerts"); got != 4 {
		t.Errorf("totalAlerts = %v, want 4 (the duplicate row for a1 must not count twice)", got)
	}
	if got := metricValue(t, data, "resolvedCount"); got != 1 {
		t.Errorf("resolvedCount = %v, want 1", got)
	}
	if got := metricValue(t, data, "acknowledgedCount"); got != 1 {
		t.Errorf("acknowledgedCount = %v, want 1", got)
	}
	if got := metricValue(t, data, "openCount"); got != 2 {
		t.Errorf("openCount = %v, want 2 (open and unknown statuses)", got)
	}
	if got := metricValue(t, data, "avgMTTRSeconds"); got != 600 {
		t.Errorf("avgMTTRSeconds = %v, want 600", got)
	}
	if got := data["avgMTTRFormatted"]; got != "10m0s" {
		t.Errorf("avgMTTRFormatted = %v, want 10m0s", got)
	}
	sum := metricValue(t, data, "openCount") + metricValue(t, data, "acknowledgedCount") +
		metricValue(t, data, "resolvedCount")
	if sum != metricValue(t, data, "totalAlerts") {
		t.Errorf("the three lifecycle buckets sum to %v, want totalAlerts %v",
			sum, metricValue(t, data, "totalAlerts"))
	}
}

func TestAlert_GetMetrics_OpenCountNeverNegative(t *testing.T) {
	// Counting acknowledged alerts from acknowledged_at and then subtracting
	// both counters from the total dropped them twice, so a fully-resolved day
	// reported a negative open count.
	now := time.Now()
	svc := newMockAlertSvc()
	svc.closuresList = []models.AlertClosure{
		{ID: "c1", AlertID: "a1", Status: "resolved", AcknowledgedAt: &now, MTTRSeconds: 300},
		{ID: "c2", AlertID: "a2", Status: "resolved", AcknowledgedAt: &now, MTTRSeconds: 900},
	}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/metrics", nil)
	h.GetMetrics(c)
	if w.Code != 200 {
		t.Fatalf("GetMetrics status = %d, want 200", w.Code)
	}
	data := readEnvelope(t, w)
	if got := metricValue(t, data, "openCount"); got < 0 {
		t.Errorf("openCount = %v, want >= 0", got)
	}
	if got := metricValue(t, data, "openCount"); got != 0 {
		t.Errorf("openCount = %v, want 0 on a fully resolved day", got)
	}
	if got := metricValue(t, data, "acknowledgedCount"); got != 0 {
		t.Errorf("acknowledgedCount = %v, want 0: both alerts are resolved", got)
	}
	if got := metricValue(t, data, "avgMTTRSeconds"); got != 600 {
		t.Errorf("avgMTTRSeconds = %v, want 600 (mean of 300 and 900)", got)
	}
}
