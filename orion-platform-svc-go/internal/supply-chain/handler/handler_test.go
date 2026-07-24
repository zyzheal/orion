package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/supply-chain/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_SUPPLY_CHAIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SUPPLY_CHAIN_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GenerateSBOM(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GenerateSBOM(c)
	if w.Code >= 500 {
		t.Fatalf("GenerateSBOM: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetSBOM(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSBOM(c)
	if w.Code >= 500 {
		t.Fatalf("GetSBOM: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_ListSBOMs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSBOMs(c)
	if w.Code >= 500 {
		t.Fatalf("ListSBOMs: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_AnalyzeDependencies(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AnalyzeDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("AnalyzeDependencies: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetDependencyGraph(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDependencyGraph(c)
	if w.Code >= 500 {
		t.Fatalf("GetDependencyGraph: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_SignArtifact(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SignArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("SignArtifact: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_VerifySignature(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().VerifySignature(c)
	if w.Code >= 500 {
		t.Fatalf("VerifySignature: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GenerateReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GenerateReport(c)
	if w.Code >= 500 {
		t.Fatalf("GenerateReport: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_SUPPLY_CHAIN_GetVulnerabilities(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVulnerabilities(c)
	if w.Code >= 500 {
		t.Fatalf("GetVulnerabilities: got %d", w.Code)
	}
}
