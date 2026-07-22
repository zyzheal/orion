package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sbom/models"
	"orion/platform-svc-go/internal/sbom/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockSBOMService struct {
	listSBOMsFn         func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error)
	generateSBOMFn      func(ctx context.Context, req *models.GenerateSBOMRequest, tenantID string) (*models.SBOMDocument, error)
	getSBOMFn           func(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error)
	deleteSBOMFn        func(ctx context.Context, id string, tenantID string) (bool, error)
	listComponentsFn    func(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error)
	listVulnsFn         func(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error)
	scanSBOMFn          func(ctx context.Context, id string, tenantID string, req *models.ScanRequest) (*models.SBOMDocument, error)
	getLicensesFn       func(ctx context.Context, sbomID string, tenantID string) ([]models.LicenseInfo, error)
	listAttestationsFn  func(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error)
	createAttestationFn func(ctx context.Context, sbomID string, tenantID string, req *models.CreateAttestationRequest) (*models.SBOMAttestation, error)
	exportSBOMFn        func(ctx context.Context, id string, tenantID string, format string) (*models.ExportResponse, error)
	compareSBOMsFn      func(ctx context.Context, fromID, toID, tenantID string) (*models.SBOMComparison, error)
}

func (m *mockSBOMService) ListSBOMs(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error) {
	return m.listSBOMsFn(ctx, tenantID, q)
}
func (m *mockSBOMService) GenerateSBOM(ctx context.Context, req *models.GenerateSBOMRequest, tenantID string) (*models.SBOMDocument, error) {
	return m.generateSBOMFn(ctx, req, tenantID)
}
func (m *mockSBOMService) GetSBOM(ctx context.Context, id string, tenantID string) (*models.SBOMDocument, error) {
	return m.getSBOMFn(ctx, id, tenantID)
}
func (m *mockSBOMService) DeleteSBOM(ctx context.Context, id string, tenantID string) (bool, error) {
	return m.deleteSBOMFn(ctx, id, tenantID)
}
func (m *mockSBOMService) ListComponents(ctx context.Context, sbomID string, tenantID string, offset, limit int) ([]models.SBOMComponent, int, error) {
	return m.listComponentsFn(ctx, sbomID, tenantID, offset, limit)
}
func (m *mockSBOMService) ListVulnerabilities(ctx context.Context, sbomID string, tenantID string, severity *string, offset, limit int) ([]models.Vulnerability, int, error) {
	return m.listVulnsFn(ctx, sbomID, tenantID, severity, offset, limit)
}
func (m *mockSBOMService) ScanSBOM(ctx context.Context, id string, tenantID string, req *models.ScanRequest) (*models.SBOMDocument, error) {
	return m.scanSBOMFn(ctx, id, tenantID, req)
}
func (m *mockSBOMService) GetLicenses(ctx context.Context, sbomID string, tenantID string) ([]models.LicenseInfo, error) {
	return m.getLicensesFn(ctx, sbomID, tenantID)
}
func (m *mockSBOMService) ListAttestations(ctx context.Context, sbomID string, tenantID string) ([]models.SBOMAttestation, error) {
	return m.listAttestationsFn(ctx, sbomID, tenantID)
}
func (m *mockSBOMService) CreateAttestation(ctx context.Context, sbomID string, tenantID string, req *models.CreateAttestationRequest) (*models.SBOMAttestation, error) {
	return m.createAttestationFn(ctx, sbomID, tenantID, req)
}
func (m *mockSBOMService) ExportSBOM(ctx context.Context, id string, tenantID string, format string) (*models.ExportResponse, error) {
	return m.exportSBOMFn(ctx, id, tenantID, format)
}
func (m *mockSBOMService) CompareSBOMs(ctx context.Context, fromID, toID, tenantID string) (*models.SBOMComparison, error) {
	return m.compareSBOMsFn(ctx, fromID, toID, tenantID)
}

// --- handler constructor override ---

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func performSBOMRequest(h *Handler, method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		c.Request.Header.Set(k, v)
	}
	// Set context values (mimics middleware)
	c.Set("tenant_id", headers["X-Tenant-ID"])

	// Call appropriate handler method based on path
	switch path {
	case "/sbom":
		if method == "GET" {
			h.ListSBOMs(c)
		} else {
			h.GenerateSBOM(c)
		}
	case "/sbom/compare":
		h.CompareSBOMs(c)
	case "/sbom/sbom-1":
		switch method {
		case "GET":
			h.GetSBOM(c)
		case "DELETE":
			h.DeleteSBOM(c)
		default:
			c.Next()
		}
	case "/sbom/sbom-1/components":
		h.ListComponents(c)
	case "/sbom/sbom-1/vulnerabilities":
		h.ListVulnerabilities(c)
	case "/sbom/sbom-1/scan":
		h.ScanSBOM(c)
	case "/sbom/sbom-1/licenses":
		h.GetLicenses(c)
	case "/sbom/sbom-1/attestation":
		if method == "GET" {
			h.ListAttestations(c)
		} else {
			h.CreateAttestation(c)
		}
	case "/sbom/sbom-1/export":
		h.ExportSBOM(c)
	default:
		c.Next()
	}

	return w
}

// --- Tests ---

func TestHandler_ListSBOMs_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		listSBOMsFn: func(_ context.Context, tenantID string, q *models.ListQuery) ([]models.SBOMDocument, int, error) {
			return []models.SBOMDocument{{ID: "sbom-1", Name: "my-app"}}, 1, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListSBOMs_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		listSBOMsFn: func(_ context.Context, _ string, _ *models.ListQuery) ([]models.SBOMDocument, int, error) {
			return nil, 0, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_GenerateSBOM_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		generateSBOMFn: func(_ context.Context, _ *models.GenerateSBOMRequest, _ string) (*models.SBOMDocument, error) {
			return &models.SBOMDocument{ID: "sbom-1", Name: "app"}, nil
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom", models.GenerateSBOMRequest{
		ArtifactID: "art-1", ArtifactType: "docker", Name: "app", Version: "1.0.0",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_GenerateSBOM_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{})
	w := performSBOMRequest(h, "POST", "/sbom", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_GenerateSBOM_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		generateSBOMFn: func(_ context.Context, _ *models.GenerateSBOMRequest, _ string) (*models.SBOMDocument, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom", models.GenerateSBOMRequest{
		ArtifactID: "art-1", ArtifactType: "docker", Name: "app", Version: "1.0.0",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_GetSBOM_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		getSBOMFn: func(_ context.Context, id string, tenantID string) (*models.SBOMDocument, error) {
			return &models.SBOMDocument{ID: id, Name: "my-app"}, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetSBOM_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		getSBOMFn: func(_ context.Context, _ string, _ string) (*models.SBOMDocument, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_DeleteSBOM_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		deleteSBOMFn: func(_ context.Context, _ string, _ string) (bool, error) {
			return true, nil
		},
	})
	w := performSBOMRequest(h, "DELETE", "/sbom/sbom-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteSBOM_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		deleteSBOMFn: func(_ context.Context, _ string, _ string) (bool, error) {
			return false, nil
		},
	})
	w := performSBOMRequest(h, "DELETE", "/sbom/sbom-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_ListComponents_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		listComponentsFn: func(_ context.Context, _ string, _ string, _, _ int) ([]models.SBOMComponent, int, error) {
			return []models.SBOMComponent{{ID: "comp-1", Name: "express"}}, 1, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/components", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListVulnerabilities_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		listVulnsFn: func(_ context.Context, _ string, _ string, _ *string, _, _ int) ([]models.Vulnerability, int, error) {
			return []models.Vulnerability{{ID: "v1", CVEID: "CVE-2023-001"}}, 1, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/vulnerabilities?severity=high", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ScanSBOM_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		scanSBOMFn: func(_ context.Context, _ string, _ string, _ *models.ScanRequest) (*models.SBOMDocument, error) {
			return &models.SBOMDocument{ID: "sbom-1", Status: models.StatusScanned}, nil
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/sbom-1/scan", models.ScanRequest{}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ScanSBOM_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		scanSBOMFn: func(_ context.Context, _ string, _ string, _ *models.ScanRequest) (*models.SBOMDocument, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/sbom-1/scan", models.ScanRequest{}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_GetLicenses_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		getLicensesFn: func(_ context.Context, _ string, _ string) ([]models.LicenseInfo, error) {
			return []models.LicenseInfo{{ID: "mit", Name: "MIT"}}, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/licenses", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListAttestations_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		listAttestationsFn: func(_ context.Context, _ string, _ string) ([]models.SBOMAttestation, error) {
			return []models.SBOMAttestation{{ID: "att-1"}}, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/attestation", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CreateAttestation_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		createAttestationFn: func(_ context.Context, _ string, _ string, _ *models.CreateAttestationRequest) (*models.SBOMAttestation, error) {
			return &models.SBOMAttestation{ID: "att-1"}, nil
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/sbom-1/attestation", models.CreateAttestationRequest{
		Type: models.AttestationProvenance, Policy: "policy",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateAttestation_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{})
	w := performSBOMRequest(h, "POST", "/sbom/sbom-1/attestation", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateAttestation_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		createAttestationFn: func(_ context.Context, _ string, _ string, _ *models.CreateAttestationRequest) (*models.SBOMAttestation, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/sbom-1/attestation", models.CreateAttestationRequest{
		Type: models.AttestationProvenance, Policy: "policy",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_ExportSBOM_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		exportSBOMFn: func(_ context.Context, _ string, _ string, _ string) (*models.ExportResponse, error) {
			return &models.ExportResponse{Format: models.FormatCycloneDX, Content: `{"bomFormat":"CycloneDX"}`}, nil
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/export", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ExportSBOM_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		exportSBOMFn: func(_ context.Context, _ string, _ string, _ string) (*models.ExportResponse, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "GET", "/sbom/sbom-1/export", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_CompareSBOMs_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		compareSBOMsFn: func(_ context.Context, fromID, toID, _ string) (*models.SBOMComparison, error) {
			return &models.SBOMComparison{FromSBOMID: fromID, ToSBOMID: toID}, nil
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/compare", models.CompareSBOMRequest{
		FromSBOMID: "from", ToSBOMID: "to",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CompareSBOMs_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{})
	w := performSBOMRequest(h, "POST", "/sbom/compare", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CompareSBOMs_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSBOMService{
		compareSBOMsFn: func(_ context.Context, _, _, _ string) (*models.SBOMComparison, error) {
			return nil, service.ErrSBOMNotFound
		},
	})
	w := performSBOMRequest(h, "POST", "/sbom/compare", models.CompareSBOMRequest{
		FromSBOMID: "from", ToSBOMID: "to",
	}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
