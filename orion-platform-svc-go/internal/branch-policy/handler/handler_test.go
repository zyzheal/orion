package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/branch-policy/models"
	"orion/platform-svc-go/internal/branch-policy/service"
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

func (f *fakeHandlerService) AddTag(ctx context.Context, tenantID string, tag string) error {
	return nil
}

func (f *fakeHandlerService) Approve(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) BatchCreate(ctx context.Context, tenantID string, reqs []models.CreateRequest) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (f *fakeHandlerService) CheckCompatibility(ctx context.Context, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) Configure(ctx context.Context, tenantID string, cfg map[string]any) error {
	return nil
}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) DeleteTag(ctx context.Context, tenantID string, tag string) error {
	return nil
}

func (f *fakeHandlerService) Deploy(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) DeregisterModel(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) DisablePlugin(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) EnablePlugin(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) EnforcePolicy(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Escalate(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Evaluate(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Forecast(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeHandlerService) GetBranchStatus(ctx context.Context, tenantID, id string) (string, error) {
	return "", nil
}

func (f *fakeHandlerService) GetByUser(ctx context.Context, tenantID, user string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetConfig(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetCoverage(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetLineage(ctx context.Context, tenantID, id string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetMetrics(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetPlugin(ctx context.Context, tenantID, id string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetResults(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetStats(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetStatus(ctx context.Context, tenantID string) (string, error) {
	return "", nil
}

func (f *fakeHandlerService) GetStatusMiddleware(ctx context.Context, tenantID string) (string, error) {
	return "", nil
}

func (f *fakeHandlerService) GetUtilization(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (f *fakeHandlerService) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListArtifacts(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListExperiments(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListHistories(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListModels(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListPending(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListPipelines(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListPlugins(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListTemplates(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListTemplates2(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) Pause(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Regenerate(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) RegisterModel(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Reject(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Restart(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Resume(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Rollback(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) RunInspection(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) RunPipeline(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) ScaleResource(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Search(ctx context.Context, tenantID, q string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) Train(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Trigger(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeHandlerService) UpdateConfig(ctx context.Context, tenantID string, cfg map[string]any) error {
	return nil
}

func (f *fakeHandlerService) UpdateStatus(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) ValidateBranch(ctx context.Context, tenantID, branch string) (bool, error) {
	return false, nil
}

// P0-MB Phase 1 stubs.
func (f *fakeHandlerService) ArchiveBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	return &models.BranchProfile{ID: id}, nil
}

func (f *fakeHandlerService) ActivateBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	return &models.BranchProfile{ID: id}, nil
}

func (f *fakeHandlerService) CreateBranchProfile(ctx context.Context, tenantID string, req *models.CreateBranchProfileRequest) (*models.BranchProfile, error) {
	return &models.BranchProfile{ID: "bp-test"}, nil
}

func (f *fakeHandlerService) GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	return &models.BranchProfile{ID: id}, nil
}

func (f *fakeHandlerService) ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error) {
	return []models.BranchProfile{}, nil
}

func (f *fakeHandlerService) UpdateBranchProfile(ctx context.Context, tenantID, id string, req *models.UpdateBranchProfileRequest) (*models.BranchProfile, error) {
	return &models.BranchProfile{ID: id}, nil
}

func (f *fakeHandlerService) DeprecateBuildArtifact(ctx context.Context, tenantID, id, reason string) (*models.BuildArtifact, error) {
	return &models.BuildArtifact{ID: id}, nil
}

func (f *fakeHandlerService) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	return &models.BuildArtifact{ID: id}, nil
}

func (f *fakeHandlerService) ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error) {
	return []models.BuildArtifact{}, nil
}

func (f *fakeHandlerService) RegisterBuildArtifact(ctx context.Context, tenantID string, req *models.RegisterArtifactRequest) (*models.BuildArtifact, error) {
	return &models.BuildArtifact{ID: "ba-test"}, nil
}

func (f *fakeHandlerService) VerifyBuildArtifactSignature(ctx context.Context, tenantID, id string) (*models.SignatureVerificationResult, error) {
	return &models.SignatureVerificationResult{ArtifactID: id, Valid: true}, nil
}

// P0-MB Phase 2 stubs — L2 NamespaceBinding.
func (f *fakeHandlerService) CreateNamespaceBinding(ctx context.Context, tenantID string, req *models.CreateNamespaceRequest) (*models.NamespaceBinding, error) {
	return &models.NamespaceBinding{ID: "nb-test", TenantID: tenantID, BranchProfileID: req.BranchProfileID, EnvName: req.EnvName, ImageTagPrefix: req.ImageTagPrefix}, nil
}

func (f *fakeHandlerService) DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error) {
	return &models.NamespaceBinding{ID: id, TenantID: tenantID}, nil
}

func (f *fakeHandlerService) GetNamespaceMatrix(ctx context.Context, tenantID string) (*models.BranchEnvMatrix, error) {
	return &models.BranchEnvMatrix{Branches: []models.MatrixRow{}, Envs: models.CanonicalEnvs}, nil
}

func (f *fakeHandlerService) ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error) {
	return []models.NamespaceBinding{}, nil
}

func (f *fakeHandlerService) ValidateNamespaceBinding(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceValidationResult, error) {
	return &models.NamespaceValidationResult{BranchProfileID: branchProfileID, EnvName: envName, Valid: true, Checks: []models.NamespaceCheck{{Field: "binding", Valid: true, Message: "ok"}}}, nil
}

func (f *fakeHandlerService) VerifyBranchEnvBinding(ctx context.Context, tenantID, branch, envName string) (bool, error) {
	return true, nil
}

func (f *fakeHandlerService) VerifyImageTagMatch(ctx context.Context, tenantID, branch, envName, imageTag string) (bool, error) {
	return true, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestBRANCH_POLICY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestBRANCH_POLICY_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ValidateBranch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ValidateBranch(c)
	if w.Code >= 500 {
		t.Fatalf("ValidateBranch: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetCoverage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCoverage(c)
	if w.Code >= 500 {
		t.Fatalf("GetCoverage: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_EnforcePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EnforcePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("EnforcePolicy: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListViolations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListViolations(c)
	if w.Code >= 500 {
		t.Fatalf("ListViolations: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_RunInspection(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RunInspection(c)
	if w.Code >= 500 {
		t.Fatalf("RunInspection: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetResults: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_UpdateStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateStatus(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListTemplates(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListTemplates(c)
	if w.Code >= 500 {
		t.Fatalf("ListTemplates: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_RunPipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RunPipeline(c)
	if w.Code >= 500 {
		t.Fatalf("RunPipeline: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Pause(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Resume(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListSchemas(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListSchemas(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchemas: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLineage(c)
	if w.Code >= 500 {
		t.Fatalf("GetLineage: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_UpdateConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetStatusMiddleware(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStatusMiddleware(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatusMiddleware: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Restart(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Restart(c)
	if w.Code >= 500 {
		t.Fatalf("Restart: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Configure(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Configure(c)
	if w.Code >= 500 {
		t.Fatalf("Configure: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListPlugins(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPlugins(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlugins: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetPlugin(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPlugin(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlugin: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_EnablePlugin(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EnablePlugin(c)
	if w.Code >= 500 {
		t.Fatalf("EnablePlugin: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_DisablePlugin(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DisablePlugin(c)
	if w.Code >= 500 {
		t.Fatalf("DisablePlugin: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Train(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Train(c)
	if w.Code >= 500 {
		t.Fatalf("Train: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Evaluate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Evaluate(c)
	if w.Code >= 500 {
		t.Fatalf("Evaluate: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Deploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Deploy(c)
	if w.Code >= 500 {
		t.Fatalf("Deploy: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Rollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListExperiments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListExperiments(c)
	if w.Code >= 500 {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListArtifacts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListArtifacts(c)
	if w.Code >= 500 {
		t.Fatalf("ListArtifacts: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListModels(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListModels(c)
	if w.Code >= 500 {
		t.Fatalf("ListModels: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_RegisterModel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RegisterModel(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterModel: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_DeregisterModel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeregisterModel(c)
	if w.Code >= 500 {
		t.Fatalf("DeregisterModel: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListPipelines(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPipelines(c)
	if w.Code >= 500 {
		t.Fatalf("ListPipelines: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Trigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Trigger(c)
	if w.Code >= 500 {
		t.Fatalf("Trigger: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListTemplates2(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListTemplates2(c)
	if w.Code >= 500 {
		t.Fatalf("ListTemplates2: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetBranchStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBranchStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetBranchStatus: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListHistories(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListHistories(c)
	if w.Code >= 500 {
		t.Fatalf("ListHistories: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListPending(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPending(c)
	if w.Code >= 500 {
		t.Fatalf("ListPending: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Approve(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Approve(c)
	if w.Code >= 500 {
		t.Fatalf("Approve: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Reject(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Reject(c)
	if w.Code >= 500 {
		t.Fatalf("Reject: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Escalate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Escalate(c)
	if w.Code >= 500 {
		t.Fatalf("Escalate: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetByUser(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetByUser(c)
	if w.Code >= 500 {
		t.Fatalf("GetByUser: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Forecast(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Forecast(c)
	if w.Code >= 500 {
		t.Fatalf("Forecast: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetUtilization(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetUtilization(c)
	if w.Code >= 500 {
		t.Fatalf("GetUtilization: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ScaleResource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ScaleResource(c)
	if w.Code >= 500 {
		t.Fatalf("ScaleResource: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListAlerts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetHistory: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_AddTag(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddTag(c)
	if w.Code >= 500 {
		t.Fatalf("AddTag: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_DeleteTag(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteTag(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTag: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_CheckCompatibility(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CheckCompatibility(c)
	if w.Code >= 500 {
		t.Fatalf("CheckCompatibility: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_BatchCreate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().BatchCreate(c)
	if w.Code >= 500 {
		t.Fatalf("BatchCreate: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Search(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Search(c)
	if w.Code >= 500 {
		t.Fatalf("Search: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_Regenerate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Regenerate(c)
	if w.Code >= 500 {
		t.Fatalf("Regenerate: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListBranchProfiles(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/branch-profiles?status=active&semantic=release&page=1&limit=10", nil, nil)
	newHandler().ListBranchProfiles(c)
	if w.Code >= 500 {
		t.Fatalf("ListBranchProfiles: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_CreateBranchProfile(t *testing.T) {
	body := map[string]any{
		"repoId":   "repo-1",
		"name":     "release/enterprise-2026",
		"semantic": "release",
		"ownerId":  "owner-1",
		"mergeTargets": []string{"main"},
	}
	c, w := makeCtx(http.MethodPost, "/branch-profiles", body, nil)
	newHandler().CreateBranchProfile(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBranchProfile: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetBranchProfile(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/branch-profiles/bp-1", nil, map[string]string{"id": "bp-1"})
	newHandler().GetBranchProfile(c)
	if w.Code >= 500 {
		t.Fatalf("GetBranchProfile: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_UpdateBranchProfile(t *testing.T) {
	body := map[string]any{"description": "updated"}
	c, w := makeCtx(http.MethodPut, "/branch-profiles/bp-1", body, map[string]string{"id": "bp-1"})
	newHandler().UpdateBranchProfile(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateBranchProfile: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ArchiveBranchProfile(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/branch-profiles/bp-1/archive", nil, map[string]string{"id": "bp-1"})
	newHandler().ArchiveBranchProfile(c)
	if w.Code >= 500 {
		t.Fatalf("ArchiveBranchProfile: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ActivateBranchProfile(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/branch-profiles/bp-1/activate", nil, map[string]string{"id": "bp-1"})
	newHandler().ActivateBranchProfile(c)
	if w.Code >= 500 {
		t.Fatalf("ActivateBranchProfile: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ListBuildArtifacts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/build-artifacts?status=active&signatureValid=true", nil, nil)
	newHandler().ListBuildArtifacts(c)
	if w.Code >= 500 {
		t.Fatalf("ListBuildArtifacts: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_RegisterBuildArtifact(t *testing.T) {
	body := map[string]any{
		"branchProfileId": "bp-1",
		"branch":          "release/x",
		"commitSha":       "abcdef0123456789abcdef0123456789abcdef01",
		"imageDigest":     "sha256:" + strings.Repeat("a", 64),
		"imageTag":        "v1.0.0",
		"imageRepo":       "reg.example/app",
		"buildPipelineId": "pipe-1",
		"targetEnvs":      []string{"staging", "prod"},
	}
	c, w := makeCtx(http.MethodPost, "/build-artifacts", body, nil)
	newHandler().RegisterBuildArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterBuildArtifact: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetBuildArtifact(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/build-artifacts/ba-1", nil, map[string]string{"id": "ba-1"})
	newHandler().GetBuildArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("GetBuildArtifact: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_VerifyBuildArtifactSignature(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/build-artifacts/ba-1/verify-signature", nil, map[string]string{"id": "ba-1"})
	newHandler().VerifyBuildArtifactSignature(c)
	if w.Code >= 500 {
		t.Fatalf("VerifyBuildArtifactSignature: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_DeprecateBuildArtifact(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/build-artifacts/ba-1/deprecate", map[string]any{"reason": "superseded"}, map[string]string{"id": "ba-1"})
	newHandler().DeprecateBuildArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("DeprecateBuildArtifact: got %d", w.Code)
	}
}

// ============================================================================
// P0-MB Phase 2 — L2 NamespaceBinding handler tests
// ============================================================================

func TestBRANCH_POLICY_Handler_ListNamespaceBindings(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/namespace-bindings?envName=prod&page=1&limit=10", nil, nil)
	newHandler().ListNamespaceBindings(c)
	if w.Code >= 500 {
		t.Fatalf("ListNamespaceBindings: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_CreateNamespaceBinding(t *testing.T) {
	body := map[string]any{
		"branchProfileId": "bp-1",
		"envName":         "prod",
		"imageTagPrefix":  "myrepo/release-ent",
	}
	c, w := makeCtx(http.MethodPost, "/namespace-bindings", body, nil)
	newHandler().CreateNamespaceBinding(c)
	if w.Code >= 500 {
		t.Fatalf("CreateNamespaceBinding: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestBRANCH_POLICY_Handler_CreateNamespaceBinding_BadBody(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/namespace-bindings", map[string]any{"envName": "prod"}, nil)
	newHandler().CreateNamespaceBinding(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing branchProfileId, got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetNamespaceMatrix(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/namespace-bindings/matrix", nil, nil)
	newHandler().GetNamespaceMatrix(c)
	if w.Code >= 500 {
		t.Fatalf("GetNamespaceMatrix: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_GetNamespaceBinding(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/namespace-bindings/nb-1", nil, map[string]string{"id": "nb-1"})
	newHandler().GetNamespaceBinding(c)
	if w.Code >= 500 {
		t.Fatalf("GetNamespaceBinding: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_DeleteNamespaceBinding(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/namespace-bindings/nb-1", nil, map[string]string{"id": "nb-1"})
	newHandler().DeleteNamespaceBinding(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteNamespaceBinding: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ValidateNamespaceBinding(t *testing.T) {
	body := map[string]any{"envName": "prod"}
	c, w := makeCtx(http.MethodPost, "/namespace-bindings/bp-1/validate", body, map[string]string{"id": "bp-1"})
	newHandler().ValidateNamespaceBinding(c)
	if w.Code >= 500 {
		t.Fatalf("ValidateNamespaceBinding: got %d", w.Code)
	}
}

func TestBRANCH_POLICY_Handler_ValidateNamespaceBinding_MissingEnv(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/namespace-bindings/bp-1/validate", map[string]any{}, map[string]string{"id": "bp-1"})
	newHandler().ValidateNamespaceBinding(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing envName, got %d", w.Code)
	}
}
