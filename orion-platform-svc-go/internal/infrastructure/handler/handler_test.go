package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/infrastructure/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeInfrastructureService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeInfrastructureService struct{}

func (f *fakeInfrastructureService) AllowTraffic(ctx context.Context, tenantID string, req models.AllowTrafficRequest) (*models.SandboxNetworkPolicy, error) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeInfrastructureService) ConfigureDnsIsolation(ctx context.Context, tenantID string, req models.DnsIsolationRequest, sandboxID string) (*models.SandboxNetworkPolicy, error) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeInfrastructureService) ConfigureEgressTraffic(ctx context.Context, tenantID string, req models.EgressTrafficRequest, sandboxID string) (*models.SandboxNetworkPolicy, error) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeInfrastructureService) Connect(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	return &models.Connector{}, nil
}

func (f *fakeInfrastructureService) CreateSandbox(ctx context.Context, tenantID string, req models.CreateSandboxRequest) (*models.SandboxInfo, error) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeInfrastructureService) DenyTraffic(ctx context.Context, tenantID string, fromEnv, toEnv string) (*models.SandboxNetworkPolicy, error) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeInfrastructureService) Disconnect(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeInfrastructureService) GetConnector(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	return &models.Connector{}, nil
}

func (f *fakeInfrastructureService) GetHealthMetrics(ctx context.Context, tenantID, connectorID string) (*models.HealthMetrics, error) {
	return &models.HealthMetrics{}, nil
}

func (f *fakeInfrastructureService) GetSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeInfrastructureService) IsolateSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeInfrastructureService) ListAllHealthMetrics(ctx context.Context, tenantID string) ([]models.HealthMetrics, error) {
	return []models.HealthMetrics{}, nil
}

func (f *fakeInfrastructureService) ListConnectors(ctx context.Context, tenantID string) ([]models.Connector, error) {
	return []models.Connector{}, nil
}

func (f *fakeInfrastructureService) ListNetworkPolicies(ctx context.Context, tenantID string) ([]models.SandboxNetworkPolicy, error) {
	return []models.SandboxNetworkPolicy{}, nil
}

func (f *fakeInfrastructureService) ListSandboxes(ctx context.Context, tenantID string) ([]models.SandboxInfo, error) {
	return []models.SandboxInfo{}, nil
}

func (f *fakeInfrastructureService) Reconnect(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	return &models.Connector{}, nil
}

func (f *fakeInfrastructureService) RegisterConnector(ctx context.Context, tenantID string, req models.RegisterConnectorRequest) (*models.Connector, error) {
	return &models.Connector{}, nil
}

func (f *fakeInfrastructureService) ReleaseSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeInfrastructureService) UnregisterConnector(ctx context.Context, tenantID, id string) error {
	return nil
}

var _ service.ServiceInterface = (*fakeInfrastructureService)(nil)
=======
type fakeinfrastructureService struct{}

func (f *fakeinfrastructureService) AllowTraffic(ctx context.Context, tenantID string, req models.AllowTrafficRequest) ((*models.SandboxNetworkPolicy, error)) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeinfrastructureService) ConfigureDnsIsolation(ctx context.Context, tenantID string, req models.DnsIsolationRequest, sandboxID string) ((*models.SandboxNetworkPolicy, error)) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeinfrastructureService) ConfigureEgressTraffic(ctx context.Context, tenantID string, req models.EgressTrafficRequest, sandboxID string) ((*models.SandboxNetworkPolicy, error)) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeinfrastructureService) Connect(ctx context.Context, tenantID, id string) ((*models.Connector, error)) {
	return &models.Connector{}, nil
}

func (f *fakeinfrastructureService) CreateSandbox(ctx context.Context, tenantID string, req models.CreateSandboxRequest) ((*models.SandboxInfo, error)) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeinfrastructureService) DenyTraffic(ctx context.Context, tenantID string, fromEnv, toEnv string) ((*models.SandboxNetworkPolicy, error)) {
	return &models.SandboxNetworkPolicy{}, nil
}

func (f *fakeinfrastructureService) Disconnect(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeinfrastructureService) GetConnector(ctx context.Context, tenantID, id string) ((*models.Connector, error)) {
	return &models.Connector{}, nil
}

func (f *fakeinfrastructureService) GetHealthMetrics(ctx context.Context, tenantID, connectorID string) ((*models.HealthMetrics, error)) {
	return &models.HealthMetrics{}, nil
}

func (f *fakeinfrastructureService) GetSandbox(ctx context.Context, tenantID, id string) ((*models.SandboxInfo, error)) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeinfrastructureService) IsolateSandbox(ctx context.Context, tenantID, id string) ((*models.SandboxInfo, error)) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeinfrastructureService) ListAllHealthMetrics(ctx context.Context, tenantID string) (([]models.HealthMetrics, error)) {
	return []models.HealthMetrics{}, nil
}

func (f *fakeinfrastructureService) ListConnectors(ctx context.Context, tenantID string) (([]models.Connector, error)) {
	return []models.Connector{}, nil
}

func (f *fakeinfrastructureService) ListNetworkPolicies(ctx context.Context, tenantID string) (([]models.SandboxNetworkPolicy, error)) {
	return []models.SandboxNetworkPolicy{}, nil
}

func (f *fakeinfrastructureService) ListSandboxes(ctx context.Context, tenantID string) (([]models.SandboxInfo, error)) {
	return []models.SandboxInfo{}, nil
}

func (f *fakeinfrastructureService) Reconnect(ctx context.Context, tenantID, id string) ((*models.Connector, error)) {
	return &models.Connector{}, nil
}

func (f *fakeinfrastructureService) RegisterConnector(ctx context.Context, tenantID string, req models.RegisterConnectorRequest) ((*models.Connector, error)) {
	return &models.Connector{}, nil
}

func (f *fakeinfrastructureService) ReleaseSandbox(ctx context.Context, tenantID, id string) ((*models.SandboxInfo, error)) {
	return &models.SandboxInfo{}, nil
}

func (f *fakeinfrastructureService) UnregisterConnector(ctx context.Context, tenantID, id string) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakeinfrastructureService)(nil)
>>>>>>> Stashed changes


func TestHandler_INFRASTRUCTURE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INFRASTRUCTU_ListConnectors(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListConnectors(c)
	if w.Code >= 500 {
		t.Fatalf("ListConnectors: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetConnector(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConnector(c)
	if w.Code >= 500 {
		t.Fatalf("GetConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_RegisterConnector(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterConnector(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Connect(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Connect(c)
	if w.Code >= 500 {
		t.Fatalf("Connect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Disconnect(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Disconnect(c)
	if w.Code >= 500 {
		t.Fatalf("Disconnect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_Reconnect(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Reconnect(c)
	if w.Code >= 500 {
		t.Fatalf("Reconnect: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_UnregisterConnector(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UnregisterConnector(c)
	if w.Code >= 500 {
		t.Fatalf("UnregisterConnector: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetHealthMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHealthMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetHealthMetrics: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ListAllHealthMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAllHealthMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("ListAllHealthMetrics: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ListSandboxes(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSandboxes(c)
	if w.Code >= 500 {
		t.Fatalf("ListSandboxes: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_GetSandbox(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("GetSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_CreateSandbox(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_IsolateSandbox(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().IsolateSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("IsolateSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ReleaseSandbox(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ReleaseSandbox(c)
	if w.Code >= 500 {
		t.Fatalf("ReleaseSandbox: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_BlockAllTraffic(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BlockAllTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("BlockAllTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_AllowTraffic(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AllowTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("AllowTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_DenyTraffic(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DenyTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("DenyTraffic: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ConfigureDnsIsolation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ConfigureDnsIsolation(c)
	if w.Code >= 500 {
		t.Fatalf("ConfigureDnsIsolation: got %d", w.Code)
	}
}
func TestHandler_INFRASTRUCTU_ConfigureEgressTraffic(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ConfigureEgressTraffic(c)
	if w.Code >= 500 {
		t.Fatalf("ConfigureEgressTraffic: got %d", w.Code)
	}
}
