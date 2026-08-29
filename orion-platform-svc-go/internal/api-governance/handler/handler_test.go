package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/api-governance/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/api-governance/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) CheckCompatibility(ctx context.Context, sourceVersion, targetVersion string) (*models.CompatibilityResult, error) {
	return &models.CompatibilityResult{}, nil
}

func (f *fakeHandlerService) CreateContract(ctx context.Context, req *models.CreateContractRequest, tenantID string) (*models.Contract, error) {
	return &models.Contract{}, nil
}

func (f *fakeHandlerService) CreateRule(ctx context.Context, req *models.CreateRuleRequest, tenantID string) (*models.Rule, error) {
	return &models.Rule{}, nil
}

func (f *fakeHandlerService) CreateVersion(ctx context.Context, req *models.CreateVersionRequest, tenantID string) (*models.Version, error) {
	return &models.Version{}, nil
}

func (f *fakeHandlerService) DeprecateVersion(ctx context.Context, id string, req *models.DeprecateVersionRequest, tenantID string) (*models.Version, error) {
	return &models.Version{}, nil
}

func (f *fakeHandlerService) EvaluateContract(ctx context.Context, id string, tenantID string) (*models.Contract, error) {
	return &models.Contract{}, nil
}

func (f *fakeHandlerService) GetContract(ctx context.Context, id string, tenantID string) (*models.Contract, error) {
	return &models.Contract{}, nil
}

func (f *fakeHandlerService) GetGovernanceStats(ctx context.Context, tenantID string) (models.GovernanceStats, error) {
	return models.GovernanceStats{}, nil
}

func (f *fakeHandlerService) GetVerificationHistory(ctx context.Context, id string, tenantID string) ([]models.VerificationHistory, error) {
	return []models.VerificationHistory{}, nil
}

func (f *fakeHandlerService) ListContracts(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Contract, error) {
	return []models.Contract{}, nil
}

func (f *fakeHandlerService) ListDeprecatedVersions(ctx context.Context, tenantID string) ([]models.Version, error) {
	return []models.Version{}, nil
}

func (f *fakeHandlerService) ListVersions(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Version, error) {
	return []models.Version{}, nil
}

func (f *fakeHandlerService) ListViolations(ctx context.Context, tenantID string, contractID *string, severity *string) ([]models.Violation, error) {
	return []models.Violation{}, nil
}

func (f *fakeHandlerService) RetireVersion(ctx context.Context, id string, tenantID string) (*models.Version, error) {
	return &models.Version{}, nil
}

func (f *fakeHandlerService) VerifyContract(ctx context.Context, id string, req *models.VerifyRequest, tenantID string) (*models.VerifyResult, error) {
	return &models.VerifyResult{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestAPI_GOVERNANCE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPI_GOVERNANCE_Handler_CreateContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateContract(c)
	if w.Code >= 500 {
		t.Fatalf("CreateContract: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_ListContracts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListContracts(c)
	if w.Code >= 500 {
		t.Fatalf("ListContracts: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_GetContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetContract(c)
	if w.Code >= 500 {
		t.Fatalf("GetContract: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_EvaluateContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EvaluateContract(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateContract: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_VerifyContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().VerifyContract(c)
	if w.Code >= 500 {
		t.Fatalf("VerifyContract: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_GetVerificationHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetVerificationHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetVerificationHistory: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_ListViolations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListViolations(c)
	if w.Code >= 500 {
		t.Fatalf("ListViolations: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_CreateVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateVersion(c)
	if w.Code >= 500 {
		t.Fatalf("CreateVersion: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_ListVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_DeprecateVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeprecateVersion(c)
	if w.Code >= 500 {
		t.Fatalf("DeprecateVersion: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_RetireVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RetireVersion(c)
	if w.Code >= 500 {
		t.Fatalf("RetireVersion: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_ListDeprecatedVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListDeprecatedVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeprecatedVersions: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_CheckCompatibility(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CheckCompatibility(c)
	if w.Code >= 500 {
		t.Fatalf("CheckCompatibility: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_CreateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_GetGovernanceReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetGovernanceReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetGovernanceReport: got %d", w.Code)
	}
}

func TestAPI_GOVERNANCE_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
