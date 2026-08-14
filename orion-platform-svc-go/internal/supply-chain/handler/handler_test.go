package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/supply-chain/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/supply-chain/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSupply_chainService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSupply_chainService struct{}

func (f *fakeSupply_chainService) AnalyzeDependencies(ctx context.Context, tenantID, packageName, version string, depth int) error {
	return nil
}

func (f *fakeSupply_chainService) GenerateSBOM(ctx context.Context, tenantID string, req *models.GenerateSBOMRequest) (*models.SBOM, error) {
	return &models.SBOM{}, nil
}

func (f *fakeSupply_chainService) GenerateSupplyChainReport(ctx context.Context, tenantID, pipelineID, artifactID string) (*models.SupplyChainReport, error) {
	return &models.SupplyChainReport{}, nil
}

func (f *fakeSupply_chainService) GetDependencyGraph(ctx context.Context, tenantID, packageName, version string) (*models.DependencyGraph, error) {
	return &models.DependencyGraph{}, nil
}

func (f *fakeSupply_chainService) GetSBOM(ctx context.Context, tenantID, sbomID string) (*models.SBOM, error) {
	return &models.SBOM{}, nil
}

func (f *fakeSupply_chainService) GetSupplyChainReport(ctx context.Context, tenantID, pipelineID string) (*models.SupplyChainReport, error) {
	return &models.SupplyChainReport{}, nil
}

func (f *fakeSupply_chainService) GetVulnerabilitiesForComponent(ctx context.Context, tenantID, name, version string) ([]models.Vulnerability, error) {
	return []models.Vulnerability{}, nil
}

func (f *fakeSupply_chainService) ListSBOMs(ctx context.Context, tenantID string, q models.ListSBOMsQuery) ([]models.SBOM, error) {
	return []models.SBOM{}, nil
}

func (f *fakeSupply_chainService) SignArtifact(ctx context.Context, tenantID, artifactID string, req *models.SignArtifactRequest) (*models.ArtifactSignature, error) {
	return &models.ArtifactSignature{}, nil
}

func (f *fakeSupply_chainService) VerifyArtifactSignature(ctx context.Context, artifactID, signature string, req *models.VerifySignatureRequest) (*models.ArtifactSignature, error) {
	return &models.ArtifactSignature{}, nil
}

var _ service.ServiceInterface = (*fakeSupply_chainService)(nil)


func TestHandler_SUPPLY_CHAIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SUPPLY_CHAIN_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GenerateSBOM(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GenerateSBOM(c)
	if w.Code >= 500 {
		t.Fatalf("GenerateSBOM: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetSBOM(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSBOM(c)
	if w.Code >= 500 {
		t.Fatalf("GetSBOM: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_ListSBOMs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSBOMs(c)
	if w.Code >= 500 {
		t.Fatalf("ListSBOMs: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_AnalyzeDependencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AnalyzeDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("AnalyzeDependencies: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetDependencyGraph(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDependencyGraph(c)
	if w.Code >= 500 {
		t.Fatalf("GetDependencyGraph: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_SignArtifact(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SignArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("SignArtifact: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_VerifySignature(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().VerifySignature(c)
	if w.Code >= 500 {
		t.Fatalf("VerifySignature: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GenerateReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GenerateReport(c)
	if w.Code >= 500 {
		t.Fatalf("GenerateReport: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetVulnerabilities(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVulnerabilities(c)
	if w.Code >= 500 {
		t.Fatalf("GetVulnerabilities: got %d", w.Code)
	}
}
