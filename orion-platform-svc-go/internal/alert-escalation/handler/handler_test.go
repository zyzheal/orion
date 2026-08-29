package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/alert-escalation/models"
	"time"

	"github.com/gin-gonic/gin"
)

var errNotFound = errors.New("not found")

type mockAlertSvc struct {
	policies map[string]*models.EscalationPolicy
	triggers []models.EscalationTrigger
	closures map[string]*models.AlertClosure
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
	p, ok := m.policies[id]
	if !ok {
		return nil, errNotFound
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
	p, ok := m.policies[id]
	if !ok {
		return nil, errNotFound
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	return p, nil
}
func (m *mockAlertSvc) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
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
	return &models.EscalationTrigger{ID: id, Status: "resolved"}, nil
}
func (m *mockAlertSvc) CreateAlertClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	c := &models.AlertClosure{ID: "ac-" + alertID, AlertID: alertID, Status: "open"}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) AcknowledgeAlert(ctx context.Context, alertID, tenantID, operator string) (*models.AlertClosure, error) {
	c := &models.AlertClosure{ID: "ac-" + alertID, AlertID: alertID, Status: "acknowledged", AcknowledgedBy: operator}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) ResolveAlert(ctx context.Context, req *models.ResolveRequest, tenantID string) (*models.AlertClosure, error) {
	c := &models.AlertClosure{ID: "ac-" + req.AlertID, AlertID: req.AlertID, Status: "resolved", ResolvedBy: req.Operator}
	m.closures[c.ID] = c
	return c, nil
}
func (m *mockAlertSvc) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	c, ok := m.closures["ac-"+alertID]
	if !ok {
		return nil, errNotFound
	}
	return c, nil
}
func (m *mockAlertSvc) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
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
