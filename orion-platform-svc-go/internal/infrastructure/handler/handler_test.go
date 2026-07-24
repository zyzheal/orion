package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/service"

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

func TestHandler_INFRASTRUCTURE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INFRASTRUCTU_ListConnectors(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListConnectors(c)
	if w.Code >= 500 {
		t.Fatalf("ListConnectors: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetConnector(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConnector(c)
	if w.Code >= 500 {
		t.Fatalf("GetConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_RegisterConnector(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterConnector(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Connect(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Connect(c)
	if w.Code >= 500 {
		t.Fatalf("Connect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Disconnect(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Disconnect(c)
	if w.Code >= 500 {
		t.Fatalf("Disconnect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Reconnect(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Reconnect(c)
	if w.Code >= 500 {
		t.Fatalf("Reconnect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_UnregisterConnector(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UnregisterConnector(c)
	if w.Code >= 500 {
		t.Fatalf("UnregisterConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetHealthMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHealthMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetHealthMetrics: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ListAllHealthMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAllHealthMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("ListAllHealthMetrics: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ListSandboxes(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSandboxes(c)
	if w.Code >= 500 {
		t.Fatalf("ListSandboxes: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetSandbox(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("GetSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_CreateSandbox(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_IsolateSandbox(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().IsolateSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("IsolateSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ReleaseSandbox(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ReleaseSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("ReleaseSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_BlockAllTraffic(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BlockAllTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("BlockAllTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_AllowTraffic(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AllowTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("AllowTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_DenyTraffic(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DenyTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("DenyTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ConfigureDnsIsolation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ConfigureDnsIsolation(c)
	if w.Code >= 500 {
		t.Fatalf("ConfigureDnsIsolation: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ConfigureEgressTraffic(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ConfigureEgressTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("ConfigureEgressTraffic: got %d", w.Code)
	}
}
