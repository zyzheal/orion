package handler

import (
	"bytes"
	"context"
	"strings"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai-security/models"

	"github.com/gin-gonic/gin"
)

// --- mock Service (implements handler's Service interface) ---

type mockSvc struct {
	listFn             func(ctx context.Context, tenantID string) ([]models.Record, error)
	getFn              func(ctx context.Context, tenantID, id string) (*models.Record, error)
	createFn           func(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	updateFn           func(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	deleteFn           func(ctx context.Context, tenantID, id string) error
	scanFn             func(ctx context.Context, tenantID, image string) (*models.ScanVulnerabilitiesResult, error)
	getVulnFn          func(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	listVulnsFn        func(ctx context.Context, tenantID string) ([]models.Vulnerability, error)
	fixVulnFn          func(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error)
	checkVulnFn        func(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error)
	listPoliciesFn     func(ctx context.Context, tenantID string) ([]string, error)
	getAuditLogFn      func(ctx context.Context, tenantID string) ([]string, error)
	blockAccessFn      func(ctx context.Context, tenantID, target string) (gin.H, error)
	getRiskScoreFn     func(ctx context.Context, tenantID, id string) (gin.H, error)
}

func (m *mockSvc) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	if m.getFn != nil { return m.getFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	if m.updateFn != nil { return m.updateFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil { return m.deleteFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) ScanVulnerabilities(ctx context.Context, tenantID, image string) (*models.ScanVulnerabilitiesResult, error) {
	if m.scanFn != nil { return m.scanFn(ctx, tenantID, image) }
	return nil, nil
}
func (m *mockSvc) GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	if m.getVulnFn != nil { return m.getVulnFn(ctx, tenantID, cveID) }
	return nil, nil
}
func (m *mockSvc) ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error) {
	if m.listVulnsFn != nil { return m.listVulnsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error) {
	if m.fixVulnFn != nil { return m.fixVulnFn(ctx, tenantID, image, cveIDs) }
	return nil, nil
}
func (m *mockSvc) CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error) {
	if m.checkVulnFn != nil { return m.checkVulnFn(ctx, tenantID, cveID) }
	return nil, nil
}
func (m *mockSvc) ListPolicies(ctx context.Context, tenantID string) ([]string, error) {
	if m.listPoliciesFn != nil { return m.listPoliciesFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetAuditLog(ctx context.Context, tenantID string) ([]string, error) {
	if m.getAuditLogFn != nil { return m.getAuditLogFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) BlockAccess(ctx context.Context, tenantID, target string) (gin.H, error) {
	if m.blockAccessFn != nil { return m.blockAccessFn(ctx, tenantID, target) }
	return nil, nil
}
func (m *mockSvc) GetRiskScore(ctx context.Context, tenantID, id string) (gin.H, error) {
	if m.getRiskScoreFn != nil { return m.getRiskScoreFn(ctx, tenantID, id) }
	return nil, nil
}

// --- helper ---

func newH(svc *mockSvc) *Handler {
	return NewHandler(svc)
}

// --- tests ---

func TestList(t *testing.T) {
	svc := &mockSvc{listFn: func(_ context.Context, _ string) ([]models.Record, error) {
		return []models.Record{{ID: "1"}}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security?page=1&limit=10", nil)
	c.Set("tenant_id", "t1")
	newH(svc).List(c)
	if w.Code != http.StatusOK { t.Errorf("List: got %d", w.Code) }
}

func TestGet(t *testing.T) {
	svc := &mockSvc{getFn: func(_ context.Context, _, id string) (*models.Record, error) {
		return &models.Record{ID: id}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: "1"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).Get(c)
	if w.Code != http.StatusOK { t.Errorf("Get: got %d", w.Code) }
}

func TestCreate(t *testing.T) {
	svc := &mockSvc{createFn: func(_ context.Context, _ string, _ models.CreateRequest) (*models.Record, error) {
		return &models.Record{ID: "1"}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/ai-security", strings.NewReader(`{"name":"test"}`))
	c.Set("tenant_id", "t1")
	newH(svc).Create(c)
	if w.Code != http.StatusOK { t.Errorf("Create: got %d", w.Code) }
}

func TestUpdate(t *testing.T) {
	svc := &mockSvc{updateFn: func(_ context.Context, _, _ string, _ models.CreateRequest) (*models.Record, error) {
		return &models.Record{ID: "1"}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: "1"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/ai-security/1", bytes.NewBuffer([]byte(`{"name":"test"}`)))
	c.Set("tenant_id", "t1")
	newH(svc).Update(c)
	if w.Code != http.StatusOK { t.Errorf("Update: got %d", w.Code) }
}

func TestDelete(t *testing.T) {
	svc := &mockSvc{deleteFn: func(_ context.Context, _, _ string) error { return nil }}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: "1"}}
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/ai-security/1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).Delete(c)
	if w.Code != http.StatusOK { t.Errorf("Delete: got %d", w.Code) }
}

func TestScanVulnerabilities(t *testing.T) {
	svc := &mockSvc{scanFn: func(_ context.Context, _, image string) (*models.ScanVulnerabilitiesResult, error) {
		return &models.ScanVulnerabilitiesResult{Image: image}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodPost, "/api/ai-security/scan/nginx:latest", bytes.NewBuffer([]byte(`{"image":"nginx:latest"}`)))
	c.Set("tenant_id", "t1")
	newH(svc).ScanVulnerabilities(c)
	if w.Code != http.StatusOK { t.Errorf("Scan: got %d", w.Code) }
}

func TestGetVulnerability(t *testing.T) {
	svc := &mockSvc{getVulnFn: func(_ context.Context, _, cveID string) (*models.Vulnerability, error) {
		return &models.Vulnerability{ID: cveID}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "cveID", Value: "CVE-2024-1"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/vuln/CVE-2024-1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).GetVulnerability(c)
	if w.Code != http.StatusOK { t.Errorf("GetVuln: got %d", w.Code) }
}

func TestListVulnerabilities(t *testing.T) {
	svc := &mockSvc{listVulnsFn: func(_ context.Context, _ string) ([]models.Vulnerability, error) {
		return []models.Vulnerability{{ID: "CVE-1"}}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/vulns", nil)
	c.Set("tenant_id", "t1")
	newH(svc).ListVulnerabilities(c)
	if w.Code != http.StatusOK { t.Errorf("ListVulns: got %d", w.Code) }
}

func TestFixVulnerability(t *testing.T) {
	svc := &mockSvc{fixVulnFn: func(_ context.Context, _, image string, cveIDs []string) (*models.FixVulnerabilityResult, error) {
		return &models.FixVulnerabilityResult{Image: image}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodPost, "/api/ai-security/fix/nginx:latest", bytes.NewBuffer([]byte(`{"image":"nginx:latest"}`)))
	c.Set("tenant_id", "t1")
	newH(svc).FixVulnerability(c)
	if w.Code != http.StatusOK { t.Errorf("Fix: got %d", w.Code) }
}

func TestCheckVulnerability(t *testing.T) {
	svc := &mockSvc{checkVulnFn: func(_ context.Context, _, cveID string) (*models.CheckVulnerabilityResult, error) {
		return &models.CheckVulnerabilityResult{CVEID: cveID}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/vulns/check?cveId=CVE-2024-1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).CheckVulnerability(c)
	if w.Code != http.StatusOK { t.Errorf("Check: got %d", w.Code) }
}

func TestListPolicies(t *testing.T) {
	svc := &mockSvc{listPoliciesFn: func(_ context.Context, _ string) ([]string, error) {
		return []string{"p1"}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/policies", nil)
	c.Set("tenant_id", "t1")
	newH(svc).ListPolicies(c)
	if w.Code != http.StatusOK { t.Errorf("ListPolicies: got %d", w.Code) }
}

func TestGetAuditLog(t *testing.T) {
	svc := &mockSvc{getAuditLogFn: func(_ context.Context, _ string) ([]string, error) {
		return []string{"a1"}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/audit-log", nil)
	c.Set("tenant_id", "t1")
	newH(svc).GetAuditLog(c)
	if w.Code != http.StatusOK { t.Errorf("AuditLog: got %d", w.Code) }
}

func TestBlockAccess(t *testing.T) {
	svc := &mockSvc{blockAccessFn: func(_ context.Context, _, _ string) (gin.H, error) {
		return gin.H{}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "target", Value: "target-1"}}
	c.Request = httptest.NewRequest(http.MethodPost, "/api/ai-security/block/target-1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).BlockAccess(c)
	if w.Code != http.StatusOK { t.Errorf("Block: got %d", w.Code) }
}

func TestGetRiskScore(t *testing.T) {
	svc := &mockSvc{getRiskScoreFn: func(_ context.Context, _, _ string) (gin.H, error) {
		return gin.H{}, nil
	}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: "m1"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ai-security/risk/m1", nil)
	c.Set("tenant_id", "t1")
	newH(svc).GetRiskScore(c)
	if w.Code != http.StatusOK { t.Errorf("Risk: got %d", w.Code) }
}

func TestRegisterRoutes(t *testing.T) {
	svc := &mockSvc{}
	r := gin.New()
	NewHandler(svc).RegisterRoutes(r.Group("/api/v1"))
	t.Log("Routes registered successfully")
}

func TestInterfaceImplementsHandlerService(t *testing.T) {
	var svc Service = &mockSvc{}
	_ = svc
}
