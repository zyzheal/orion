package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/iac/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/iac/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
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
type fakeHandlerService struct{}

func (f *fakeHandlerService) ApplyPlan(ctx context.Context, tenantID, workspaceID string, req models.ApplyPlanRequest) (*models.PlanSummary, error) {
	return &models.PlanSummary{}, nil
}

func (f *fakeHandlerService) CreateModule(ctx context.Context, tenantID string, req models.CreateModuleRequest) (*models.WorkspaceModule, error) {
	return &models.WorkspaceModule{}, nil
}

func (f *fakeHandlerService) CreateWorkspace(ctx context.Context, tenantID string, req models.CreateWorkspaceRequest) (*models.Workspace, error) {
	return &models.Workspace{}, nil
}

func (f *fakeHandlerService) DeleteModule(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) GeneratePlan(ctx context.Context, tenantID, workspaceID string, req models.GeneratePlanRequest) (*models.PlanSummary, error) {
	return &models.PlanSummary{}, nil
}

func (f *fakeHandlerService) GetCurrentState(ctx context.Context, tenantID, workspaceID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetModule(ctx context.Context, tenantID, id string) (*models.WorkspaceModule, error) {
	return &models.WorkspaceModule{}, nil
}

func (f *fakeHandlerService) GetPlan(ctx context.Context, tenantID, planID string) (*models.Plan, error) {
	return &models.Plan{}, nil
}

func (f *fakeHandlerService) GetStateDiff(ctx context.Context, tenantID, workspaceID, versionA, versionB string) (*models.StateDiffResult, error) {
	return &models.StateDiffResult{}, nil
}

func (f *fakeHandlerService) GetWorkspace(ctx context.Context, tenantID, id string) (*models.Workspace, error) {
	return &models.Workspace{}, nil
}

func (f *fakeHandlerService) ImportResource(ctx context.Context, tenantID, workspaceID string, req models.ImportResourceRequest) (*models.Resource, error) {
	return &models.Resource{}, nil
}

func (f *fakeHandlerService) ListModules(ctx context.Context, tenantID string) ([]models.WorkspaceModule, error) {
	return []models.WorkspaceModule{}, nil
}

func (f *fakeHandlerService) ListPlans(ctx context.Context, tenantID, workspaceID string) ([]models.Plan, error) {
	return []models.Plan{}, nil
}

func (f *fakeHandlerService) ListResources(ctx context.Context, tenantID, workspaceID string) ([]models.Resource, error) {
	return []models.Resource{}, nil
}

func (f *fakeHandlerService) ListStateVersions(ctx context.Context, tenantID, workspaceID string) ([]models.StateVersion, error) {
	return []models.StateVersion{}, nil
}

func (f *fakeHandlerService) ListWorkspaces(ctx context.Context, tenantID string, limit, offset int) ([]models.Workspace, error) {
	return []models.Workspace{}, nil
}

func (f *fakeHandlerService) UpdateWorkspace(ctx context.Context, tenantID, id string, req models.UpdateWorkspaceRequest) (*models.Workspace, error) {
	return &models.Workspace{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakeiacService struct{}

func (f *fakeiacService) ApplyPlan(ctx context.Context, tenantID, workspaceID string, req models.ApplyPlanRequest) ((*models.PlanSummary, error)) {
	return &models.PlanSummary{}, nil
}

func (f *fakeiacService) CreateModule(ctx context.Context, tenantID string, req models.CreateModuleRequest) ((*models.WorkspaceModule, error)) {
	return &models.WorkspaceModule{}, nil
}

func (f *fakeiacService) CreateWorkspace(ctx context.Context, tenantID string, req models.CreateWorkspaceRequest) ((*models.Workspace, error)) {
	return &models.Workspace{}, nil
}

func (f *fakeiacService) DeleteModule(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeiacService) GeneratePlan(ctx context.Context, tenantID, workspaceID string, req models.GeneratePlanRequest) ((*models.PlanSummary, error)) {
	return &models.PlanSummary{}, nil
}

func (f *fakeiacService) GetCurrentState(ctx context.Context, tenantID, workspaceID string) ((map[string]any, error)) {
	return map[string]any{}, nil
}

func (f *fakeiacService) GetModule(ctx context.Context, tenantID, id string) ((*models.WorkspaceModule, error)) {
	return &models.WorkspaceModule{}, nil
}

func (f *fakeiacService) GetPlan(ctx context.Context, tenantID, planID string) ((*models.Plan, error)) {
	return &models.Plan{}, nil
}

func (f *fakeiacService) GetStateDiff(ctx context.Context, tenantID, workspaceID, versionA, versionB string) ((*models.StateDiffResult, error)) {
	return &models.StateDiffResult{}, nil
}

func (f *fakeiacService) GetWorkspace(ctx context.Context, tenantID, id string) ((*models.Workspace, error)) {
	return &models.Workspace{}, nil
}

func (f *fakeiacService) ImportResource(ctx context.Context, tenantID, workspaceID string, req models.ImportResourceRequest) ((*models.Resource, error)) {
	return &models.Resource{}, nil
}

func (f *fakeiacService) ListModules(ctx context.Context, tenantID string) (([]models.WorkspaceModule, error)) {
	return []models.WorkspaceModule{}, nil
}

func (f *fakeiacService) ListPlans(ctx context.Context, tenantID, workspaceID string) (([]models.Plan, error)) {
	return []models.Plan{}, nil
}

func (f *fakeiacService) ListResources(ctx context.Context, tenantID, workspaceID string) (([]models.Resource, error)) {
	return []models.Resource{}, nil
}

func (f *fakeiacService) ListStateVersions(ctx context.Context, tenantID, workspaceID string) (([]models.StateVersion, error)) {
	return []models.StateVersion{}, nil
}

func (f *fakeiacService) ListWorkspaces(ctx context.Context, tenantID string, limit, offset int) (([]models.Workspace, error)) {
	return []models.Workspace{}, nil
}

func (f *fakeiacService) UpdateWorkspace(ctx context.Context, tenantID, id string, req models.UpdateWorkspaceRequest) ((*models.Workspace, error)) {
	return &models.Workspace{}, nil
}

var _ service.ServiceInterface = (*fakeiacService)(nil)
>>>>>>> Stashed changes


func TestHandler_IAC_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_IAC_ListWorkspaces(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListWorkspaces(c)
	if w.Code >= 500 {
		t.Fatalf("ListWorkspaces: got %d", w.Code)
	}
}
func TestHandler_IAC_CreateWorkspace(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("CreateWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_GetWorkspace(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("GetWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_UpdateWorkspace(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_GeneratePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GeneratePlan(c)
	if w.Code >= 500 {
		t.Fatalf("GeneratePlan: got %d", w.Code)
	}
}
func TestHandler_IAC_ApplyPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApplyPlan(c)
	if w.Code >= 500 {
		t.Fatalf("ApplyPlan: got %d", w.Code)
	}
}
func TestHandler_IAC_GetCurrentState(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCurrentState(c)
	if w.Code >= 500 {
		t.Fatalf("GetCurrentState: got %d", w.Code)
	}
}
func TestHandler_IAC_ListResources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListResources(c)
	if w.Code >= 500 {
		t.Fatalf("ListResources: got %d", w.Code)
	}
}
func TestHandler_IAC_ImportResource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ImportResource(c)
	if w.Code >= 500 {
		t.Fatalf("ImportResource: got %d", w.Code)
	}
}
func TestHandler_IAC_ListStateVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStateVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListStateVersions: got %d", w.Code)
	}
}
func TestHandler_IAC_GetStateDiff(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStateDiff(c)
	if w.Code >= 500 {
		t.Fatalf("GetStateDiff: got %d", w.Code)
	}
}
func TestHandler_IAC_ListPlans(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPlans(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlans: got %d", w.Code)
	}
}
func TestHandler_IAC_GetPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPlan(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlan: got %d", w.Code)
	}
}
func TestHandler_IAC_ListModules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListModules(c)
	if w.Code >= 500 {
		t.Fatalf("ListModules: got %d", w.Code)
	}
}
func TestHandler_IAC_CreateModule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateModule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateModule: got %d", w.Code)
	}
}
func TestHandler_IAC_GetModule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetModule(c)
	if w.Code >= 500 {
		t.Fatalf("GetModule: got %d", w.Code)
	}
}
func TestHandler_IAC_DeleteModule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteModule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteModule: got %d", w.Code)
	}
}
