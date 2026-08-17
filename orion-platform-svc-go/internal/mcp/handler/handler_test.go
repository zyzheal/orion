package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/mcp/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/mcp/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeMcpService{})
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
type fakeMcpService struct{}

func (f *fakeMcpService) CreateServer(ctx context.Context, tenantID string, req models.CreateMCPServerRequest) (*models.MCPServer, error) {
	return &models.MCPServer{}, nil
}

func (f *fakeMcpService) DeleteServer(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeMcpService) GetServer(ctx context.Context, tenantID, id string) (*models.MCPServer, error) {
	return &models.MCPServer{}, nil
}

func (f *fakeMcpService) ListServers(ctx context.Context, tenantID string, q models.ListMCPServersQuery) (*models.MCPServerListResponse, error) {
	return &models.MCPServerListResponse{}, nil
}

func (f *fakeMcpService) ListTools(ctx context.Context, q models.ListMCPToolsQuery) (*models.MCPToolListResponse, error) {
	return &models.MCPToolListResponse{}, nil
}

func (f *fakeMcpService) UpdateServer(ctx context.Context, tenantID, id string, req models.UpdateMCPServerRequest) (*models.MCPServer, error) {
	return &models.MCPServer{}, nil
}

var _ service.ServiceInterface = (*fakeMcpService)(nil)
=======
type fakemcpService struct{}

func (f *fakemcpService) CreateServer(ctx context.Context, tenantID string, req models.CreateMCPServerRequest) ((*models.MCPServer, error)) {
	return &models.MCPServer{}, nil
}

func (f *fakemcpService) DeleteServer(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakemcpService) GetServer(ctx context.Context, tenantID, id string) ((*models.MCPServer, error)) {
	return &models.MCPServer{}, nil
}

func (f *fakemcpService) ListServers(ctx context.Context, tenantID string, q models.ListMCPServersQuery) ((*models.MCPServerListResponse, error)) {
	return &models.MCPServerListResponse{}, nil
}

func (f *fakemcpService) ListTools(ctx context.Context, q models.ListMCPToolsQuery) ((*models.MCPToolListResponse, error)) {
	return &models.MCPToolListResponse{}, nil
}

func (f *fakemcpService) UpdateServer(ctx context.Context, tenantID, id string, req models.UpdateMCPServerRequest) ((*models.MCPServer, error)) {
	return &models.MCPServer{}, nil
}

var _ service.ServiceInterface = (*fakemcpService)(nil)
>>>>>>> Stashed changes


func TestHandler_MCP_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MCP_CreateServer(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateServer(c)
	if w.Code >= 500 {
		t.Fatalf("CreateServer: got %d", w.Code)
	}
}
func TestHandler_MCP_DeleteServer(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteServer(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteServer: got %d", w.Code)
	}
}
func TestHandler_MCP_GetServer(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServer(c)
	if w.Code >= 500 {
		t.Fatalf("GetServer: got %d", w.Code)
	}
}
func TestHandler_MCP_ListServers(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListServers(c)
	if w.Code >= 500 {
		t.Fatalf("ListServers: got %d", w.Code)
	}
}
func TestHandler_MCP_ListTools(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTools(c)
	if w.Code >= 500 {
		t.Fatalf("ListTools: got %d", w.Code)
	}
}
func TestHandler_MCP_UpdateServer(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateServer(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateServer: got %d", w.Code)
	}
}
