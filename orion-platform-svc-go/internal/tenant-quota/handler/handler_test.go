package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/tenant-quota/models"

	"github.com/gin-gonic/gin"
)

var errNotFoundQ = errors.New("not found")

type mockQuotaSvc struct {
	plans  map[string]*models.QuotaPlan
	usages map[string]models.QuotaUsage
	alerts []models.QuotaAlert
}

func newMockQuotaSvc() *mockQuotaSvc {
	return &mockQuotaSvc{
		plans:  make(map[string]*models.QuotaPlan),
		usages: make(map[string]models.QuotaUsage),
	}
}

func (m *mockQuotaSvc) CreatePlan(ctx context.Context, req *models.CreatePlanRequest, tenantID string) (*models.QuotaPlan, error) {
	p := &models.QuotaPlan{ID: "qp-" + req.Name, Name: req.Name, TenantID: tenantID}
	if p.MaxUsers == 0 {
		p.MaxUsers = 500
	}
	m.plans[p.ID] = p
	return p, nil
}
func (m *mockQuotaSvc) GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error) {
	p, ok := m.plans[id]
	if !ok {
		return nil, errNotFoundQ
	}
	return p, nil
}
func (m *mockQuotaSvc) ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error) {
	var items []models.QuotaPlan
	for _, p := range m.plans {
		items = append(items, *p)
	}
	if items == nil {
		items = []models.QuotaPlan{}
	}
	return items, nil
}
func (m *mockQuotaSvc) UpdatePlan(ctx context.Context, id, tenantID string, req *models.UpdatePlanRequest) (*models.QuotaPlan, error) {
	p, ok := m.plans[id]
	if !ok {
		return nil, errNotFoundQ
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	return p, nil
}
func (m *mockQuotaSvc) DeletePlan(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := m.plans[id]; !ok {
		return false, nil
	}
	delete(m.plans, id)
	return true, nil
}
func (m *mockQuotaSvc) GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error) {
	u, ok := m.usages[metric]
	if !ok {
		return nil, errNotFoundQ
	}
	return &u, nil
}
func (m *mockQuotaSvc) ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsageWithLimit, error) {
	if m.usages == nil {
		return []models.QuotaUsageWithLimit{}, nil
	}
	var result []models.QuotaUsageWithLimit
	for _, u := range m.usages {
		result = append(result, models.QuotaUsageWithLimit{QuotaUsage: u})
	}
	return result, nil
}
func (m *mockQuotaSvc) IncrementUsage(ctx context.Context, req *models.IncrementUsageRequest, tenantID string) (*models.QuotaUsageWithLimit, error) {
	return &models.QuotaUsageWithLimit{QuotaUsage: models.QuotaUsage{Metric: req.Metric}, Status: "normal"}, nil
}
func (m *mockQuotaSvc) ResetUsage(ctx context.Context, tenantID string) error {
	return nil
}
func (m *mockQuotaSvc) CheckQuota(ctx context.Context, tenantID, metric string, amount int64) (*models.QuotaCheckResult, error) {
	return &models.QuotaCheckResult{Metric: metric, Allowed: true, Remaining: 100}, nil
}
func (m *mockQuotaSvc) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error) {
	if m.alerts == nil {
		m.alerts = []models.QuotaAlert{}
	}
	return m.alerts, nil
}

func makeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Params = gin.Params{{Key: "id", Value: "plan-1"}, {Key: "metric", Value: "users"}}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func TestQuota_RegisterRoutes(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	r := gin.New()
	rg := &r.RouterGroup
	h.RegisterRoutes(rg)
}

func TestQuota_CreatePlan(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	c, w := makeCtx(http.MethodPost, "/plans", map[string]interface{}{"name": "free"})
	h.CreatePlan(c)
	if w.Code != 201 {
		t.Fatalf("CreatePlan status = %d, want 201", w.Code)
	}
}

func TestQuota_GetPlan_NotFound(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	c, w := makeCtx(http.MethodGet, "/plans/:id", nil)
	h.GetPlan(c)
	if w.Code != 404 {
		t.Fatalf("GetPlan status = %d, want 404", w.Code)
	}
}

func TestQuota_DeletePlan(t *testing.T) {
	svc := newMockQuotaSvc()
	svc.plans["plan-1"] = &models.QuotaPlan{ID: "plan-1", Name: "del"}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodDelete, "/plans/:id", nil)
	h.DeletePlan(c)
	if w.Code != 200 {
		t.Fatalf("DeletePlan status = %d, want 200", w.Code)
	}
}

func TestQuota_IncrementUsage(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	c, w := makeCtx(http.MethodPost, "/usage/increment", map[string]interface{}{
		"metric": "api_rate_per_min", "amount": 10,
	})
	h.IncrementUsage(c)
	if w.Code != 200 {
		t.Fatalf("IncrementUsage status = %d, want 200", w.Code)
	}
}

func TestQuota_CheckQuota(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	c, w := makeCtx(http.MethodPost, "/check", map[string]interface{}{
		"metric": "users", "amount": 5,
	})
	h.CheckQuota(c)
	if w.Code != 200 {
		t.Fatalf("CheckQuota status = %d, want 200", w.Code)
	}
}

func TestQuota_ListUsage(t *testing.T) {
	h := NewHandler(newMockQuotaSvc())
	c, w := makeCtx(http.MethodGet, "/usage", nil)
	h.ListUsage(c)
	if w.Code != 200 {
		t.Fatalf("ListUsage status = %d, want 200", w.Code)
	}
}