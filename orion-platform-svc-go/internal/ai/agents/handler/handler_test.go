package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/agents/models"
	"orion/platform-svc-go/internal/ai/agents/repository"
	"orion/platform-svc-go/internal/ai/agents/service"

	"github.com/gin-gonic/gin"
)

type fakeAgentsService struct {
	registerCalled bool
	deleteCalled   bool
}

func (f *fakeAgentsService) ListAgents(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.AIAgent, error) {
	return []models.AIAgent{}, nil
}
func (f *fakeAgentsService) GetAgent(ctx context.Context, id string, tenantID string) (*models.AIAgent, error) {
	return &models.AIAgent{ID: id}, nil
}
func (f *fakeAgentsService) RegisterAgent(ctx context.Context, tenantID string, userID string, req *models.RegisterAgentRequest) (*models.AIAgent, error) {
	f.registerCalled = true
	return &models.AIAgent{ID: "agent-1"}, nil
}
func (f *fakeAgentsService) UpdateAgent(ctx context.Context, id string, tenantID string, req *models.UpdateAgentRequest) (*models.AIAgent, error) {
	return &models.AIAgent{ID: id}, nil
}
func (f *fakeAgentsService) DeleteAgent(ctx context.Context, id string, tenantID string) (bool, error) {
	f.deleteCalled = true
	return true, nil
}
func (f *fakeAgentsService) UpdateAgentStatus(ctx context.Context, id string, tenantID string, status models.AgentStatus) (*models.AIAgent, error) {
	return &models.AIAgent{ID: id}, nil
}
func (f *fakeAgentsService) ExecuteAgent(ctx context.Context, agentID string, tenantID string, req *models.ExecuteAgentRequest) (*models.ExecuteAgentResult, error) {
	return &models.ExecuteAgentResult{Success: true}, nil
}
func (f *fakeAgentsService) GetAuditLogs(ctx context.Context, agentID string, tenantID string, limit int) ([]models.AgentAuditLog, error) {
	return []models.AgentAuditLog{}, nil
}
func (f *fakeAgentsService) RecordAuditLog(ctx context.Context, tenantID string, log *models.AgentAuditLog) error {
	return nil
}
func (f *fakeAgentsService) GetAgentStats(ctx context.Context, tenantID string) (*models.AgentStats, error) {
	return &models.AgentStats{}, nil
}
func (f *fakeAgentsService) CountAgents(ctx context.Context, tenantID string, filter *repository.ListFilter) (int64, error) {
	return 0, nil
}
func (f *fakeAgentsService) AgentToInfo(a *models.AIAgent) (*models.AgentInfo, error) {
	return &models.AgentInfo{}, nil
}
func (f *fakeAgentsService) AgentAuditLogToResponse(log *models.AgentAuditLog) (*models.AgentAuditLogResponse, error) {
	return &models.AgentAuditLogResponse{}, nil
}

var _ service.ServiceInterface = (*fakeAgentsService)(nil)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
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
func makeCtxForm(method string, path string, body string, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

func TestAI_AGENTS_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_AGENTS_Handler_List(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodGet, "/api/v1/ai-agents", nil, nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_Create(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodPost, "/api/v1/ai-agents", models.RegisterAgentRequest{
		Name: "test-agent", Scenario: "ops", Provider: "local",
	}, nil)
	h.Create(c)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
	if !fake.registerCalled {
		t.Fatal("RegisterAgent service not called")
	}
}

func TestAI_AGENTS_Handler_Get(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodGet, "/api/v1/ai-agents/agent-1", nil, map[string]string{"id": "agent-1"})
	h.Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_Update(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodPut, "/api/v1/ai-agents/agent-1", models.UpdateAgentRequest{}, map[string]string{"id": "agent-1"})
	h.Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_Delete(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodDelete, "/api/v1/ai-agents/agent-1", nil, map[string]string{"id": "agent-1"})
	h.Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
	if !fake.deleteCalled {
		t.Fatal("DeleteAgent service not called")
	}
}

func TestAI_AGENTS_Handler_UpdateStatus(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtxForm(http.MethodPost, "/api/v1/ai-agents/agent-1/status", "status=running", map[string]string{"id": "agent-1"})
	h.UpdateStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_GetAuditLogs(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodGet, "/api/v1/ai-agents/agent-1/audit-logs", nil, map[string]string{"id": "agent-1"})
	h.GetAuditLogs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAuditLogs: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_GetStats(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodGet, "/api/v1/ai-agents/stats", nil, nil)
	h.GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestAI_AGENTS_Handler_Execute(t *testing.T) {
	fake := &fakeAgentsService{}
	h := NewHandler(fake)
	c, w := makeCtx(http.MethodPost, "/api/v1/ai-agents/agent-1/execute", models.ExecuteAgentRequest{Input: map[string]interface{}{"cmd": "test"}}, map[string]string{"id": "agent-1"})
	h.Execute(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("Execute: got %d", w.Code)
	}
}
