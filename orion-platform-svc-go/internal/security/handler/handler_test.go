package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/security/models"
	"orion/platform-svc-go/internal/security/service"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements handler Service interface) ---

type mockSecurityService struct {
	report     *models.VulnerabilityReport
	reportErr  error
	scanResult *models.ScanResult
	scanErr    error
	vuln       *models.Vulnerability
	vulnErr    error
	remediated *models.Vulnerability
	remedErr   error
}

func (m *mockSecurityService) ScanImage(_ context.Context, _ string, _ string) (*models.ScanResult, error) {
	return &models.ScanResult{
		ScanID:               "scan-img-mock",
		PackageManager:       "docker",
		VulnerabilitiesFound: 0,
	}, nil
}

func (m *mockSecurityService) GetVulnerabilityReport(_ context.Context, _ string, _ models.ListVulnerabilitiesOptions) (*models.VulnerabilityReport, error) {
	return m.report, m.reportErr
}

func (m *mockSecurityService) ScanDependencies(_ context.Context, _ string, _ string) (*models.ScanResult, error) {
	return m.scanResult, m.scanErr
}

func (m *mockSecurityService) CheckVulnerability(_ context.Context, _ string, _ string) (*models.Vulnerability, error) {
	return m.vuln, m.vulnErr
}

func (m *mockSecurityService) RemediateVulnerability(_ context.Context, _ string, _ string, _ string, _ models.RemediateVulnerabilityRequest) (*models.Vulnerability, error) {
	return m.remediated, m.remedErr
}

// --- helpers ---

func newHandlerWithSvc(svc Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// ==================== ListVulnerabilities ====================

func TestHandler_ListVulnerabilities_Success(t *testing.T) {
	vuln := &models.Vulnerability{ID: "v1", CVEID: "CVE-2021-1", PackageName: "lodash", Severity: models.VulnerabilitySeverityHigh, Status: models.VulnerabilityStatusOpen}
	svc := &mockSecurityService{
		report: &models.VulnerabilityReport{
			Vulnerabilities: []models.Vulnerability{*vuln},
			TotalVulnerabilities: 1,
			BySeverity: map[string]int{"high": 1},
			ByStatus: map[string]int{"open": 1},
		},
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ListVulnerabilities, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListVulnerabilities_ServiceError(t *testing.T) {
	svc := &mockSecurityService{
		reportErr: errors.New("db error"),
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ListVulnerabilities, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_ListVulnerabilities_Empty(t *testing.T) {
	svc := &mockSecurityService{
		report: &models.VulnerabilityReport{
			Vulnerabilities:        []models.Vulnerability{},
			TotalVulnerabilities:   0,
			BySeverity:             make(map[string]int),
			ByStatus:               make(map[string]int),
		},
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ListVulnerabilities, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== TriggerScan ====================

func TestHandler_TriggerScan_Success(t *testing.T) {
	result := &models.ScanResult{
		ScanID:               "scan-1",
		PackageManager:       "npm",
		TotalDependencies:    10,
		VulnerabilitiesFound: 2,
		ScannedAt:            time.Now().UTC(),
		Tool:                 "npm-audit",
	}
	svc := &mockSecurityService{
		scanResult: result,
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.TriggerScan, "POST", models.ScanVulnerabilitiesRequest{ProjectPath: "/src"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_TriggerScan_ServiceError(t *testing.T) {
	svc := &mockSecurityService{
		scanErr: errors.New("scan failed"),
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.TriggerScan, "POST", models.ScanVulnerabilitiesRequest{ProjectPath: "/src"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== GetVulnerability ====================

func TestHandler_GetVulnerability_Success(t *testing.T) {
	vuln := &models.Vulnerability{
		ID: "v-1", CVEID: "CVE-2021-1", PackageName: "lodash",
		PackageVersion: "4.17.15", Severity: models.VulnerabilitySeverityHigh,
		Description: "test vuln", FixVersion: "4.17.20",
		Status: models.VulnerabilityStatusOpen,
	}
	svc := &mockSecurityService{
		vuln: vuln,
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetVulnerability, "GET", nil, map[string]string{"id": "v-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetVulnerability_NotFound(t *testing.T) {
	svc := &mockSecurityService{
		vulnErr: errors.New("vulnerability not found"),
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetVulnerability, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Remediate ====================

func TestHandler_Remediate_Success(t *testing.T) {
	vuln := &models.Vulnerability{
		ID: "v-1", CVEID: "CVE-2021-1", PackageName: "lodash",
		Status: models.VulnerabilityStatusRemediated,
		UpdatedAt: time.Now().UTC(),
	}
	svc := &mockSecurityService{
		remediated: vuln,
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Remediate, "POST", models.RemediateVulnerabilityRequest{
		Action: models.VulnerabilityStatusRemediated,
		Reason: "upgraded",
	}, map[string]string{"id": "v-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Remediate_InvalidAction(t *testing.T) {
	svc := &mockSecurityService{
		remedErr: service.ErrInvalidInput,
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Remediate, "POST", map[string]string{"action": "open"}, map[string]string{"id": "v-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Remediate_NotFound(t *testing.T) {
	svc := &mockSecurityService{
		remedErr: service.ErrNotFound,
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Remediate, "POST", models.RemediateVulnerabilityRequest{
		Action: models.VulnerabilityStatusRemediated,
	}, map[string]string{"id": "v-1"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Remediate_ServiceError(t *testing.T) {
	svc := &mockSecurityService{
		remedErr: errors.New("db error"),
	}
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Remediate, "POST", models.RemediateVulnerabilityRequest{
		Action: models.VulnerabilityStatusRemediated,
	}, map[string]string{"id": "v-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}
