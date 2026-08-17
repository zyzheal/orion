package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cmdb/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/cmdb/models"
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
type fakeHandlerService struct{}

func (f *fakeHandlerService) BatchCreate(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeHandlerService) BatchDelete(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeHandlerService) BatchQuery(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeHandlerService) BatchUpdate(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeHandlerService) Create(ctx context.Context, req *models.CreateCIRequest) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) CreateRelation(ctx context.Context, req *models.CreateRelationRequest) (*models.CIRelation, error) {
	return &models.CIRelation{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, id string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) ExecuteScript(ctx context.Context, req *models.ScriptExecRequest) (*models.ScriptExecResult, error) {
	return &models.ScriptExecResult{}, nil
}

func (f *fakeHandlerService) ExportCI(ctx context.Context, id string, tenantID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) (*models.ExportResult, error) {
	return &models.ExportResult{}, nil
}

func (f *fakeHandlerService) Get(ctx context.Context, id string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) GetByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) {
	return &models.CIVersion{}, nil
}

func (f *fakeHandlerService) GetHost(ctx context.Context, ciID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeHandlerService) GetRelations(ctx context.Context, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeHandlerService) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeHandlerService) GetTopology(ctx context.Context, ciType *string, depth *int, tenantID string) (*models.TopologyResult, error) {
	return &models.TopologyResult{}, nil
}

func (f *fakeHandlerService) GetVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	return []models.CIVersion{}, nil
}

func (f *fakeHandlerService) Health(ctx context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{}, nil
}

func (f *fakeHandlerService) ImportCIs(ctx context.Context, cis []any, tenantID string, skipDuplicates bool, createdBy string) (*models.ExportResult, error) {
	return &models.ExportResult{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeHandlerService) ListCICDResources(ctx context.Context, status *string, limit, offset int) ([]models.CICDResource, int, error) {
	return []models.CICDResource{}, 0, nil
}

func (f *fakeHandlerService) ListHosts(ctx context.Context, status *string, tags *string, limit, offset int) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeHandlerService) ListK8sResources(ctx context.Context, kind *string, namespace *string, limit, offset int) ([]models.K8sResource, int, error) {
	return []models.K8sResource{}, 0, nil
}

func (f *fakeHandlerService) RestoreToVersion(ctx context.Context, ciID string, version int, user string, tenantID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) StartK8sSync(ctx context.Context, config *models.StartK8sSyncRequest) (error) {
	return nil
}

func (f *fakeHandlerService) StopK8sSync(ctx context.Context) (error) {
	return nil
}

func (f *fakeHandlerService) Update(ctx context.Context, id string, req *models.UpdateCIRequest) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeHandlerService) Search(ctx context.Context, tenantID, query, domain string) ([]models.CI, error) {
	return []models.CI{}, nil
}

func (f *fakeHandlerService) GenerateRecommendations(ctx context.Context, tenantID string, reqType *models.RecommendationType, limit int) (*models.RecommendationResult, error) {
	return &models.RecommendationResult{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)


type fakeCmdbService struct{}

func (f *fakeCmdbService) BatchCreate(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeCmdbService) BatchDelete(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeCmdbService) BatchQuery(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeCmdbService) BatchUpdate(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error) {
	return &models.BatchResult{}, nil
}

func (f *fakeCmdbService) Create(ctx context.Context, req *models.CreateCIRequest) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) CreateRelation(ctx context.Context, req *models.CreateRelationRequest) (*models.CIRelation, error) {
	return &models.CIRelation{}, nil
}

func (f *fakeCmdbService) Delete(ctx context.Context, id string) (bool, error) {
	return false, nil
}

func (f *fakeCmdbService) DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeCmdbService) ExecuteScript(ctx context.Context, req *models.ScriptExecRequest) (*models.ScriptExecResult, error) {
	return &models.ScriptExecResult{}, nil
}

func (f *fakeCmdbService) ExportCI(ctx context.Context, id string, tenantID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) (*models.ExportResult, error) {
	return &models.ExportResult{}, nil
}

func (f *fakeCmdbService) Get(ctx context.Context, id string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) GetByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) {
	return &models.CIVersion{}, nil
}

func (f *fakeCmdbService) GetHost(ctx context.Context, ciID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeCmdbService) GetRelations(ctx context.Context, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeCmdbService) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return []models.CIRelation{}, nil
}

func (f *fakeCmdbService) GetTopology(ctx context.Context, ciType *string, depth *int, tenantID string) (*models.TopologyResult, error) {
	return &models.TopologyResult{}, nil
}

func (f *fakeCmdbService) GetVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	return []models.CIVersion{}, nil
}

func (f *fakeCmdbService) Health(ctx context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{}, nil
}

func (f *fakeCmdbService) ImportCIs(ctx context.Context, cis []any, tenantID string, skipDuplicates bool, createdBy string) (*models.ExportResult, error) {
	return &models.ExportResult{}, nil
}

func (f *fakeCmdbService) List(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeCmdbService) ListCICDResources(ctx context.Context, status *string, limit, offset int) ([]models.CICDResource, int, error) {
	return []models.CICDResource{}, 0, nil
}

func (f *fakeCmdbService) ListHosts(ctx context.Context, status *string, tags *string, limit, offset int) ([]models.CI, int, error) {
	return []models.CI{}, 0, nil
}

func (f *fakeCmdbService) ListK8sResources(ctx context.Context, kind *string, namespace *string, limit, offset int) ([]models.K8sResource, int, error) {
	return []models.K8sResource{}, 0, nil
}

func (f *fakeCmdbService) RestoreToVersion(ctx context.Context, ciID string, version int, user string, tenantID string) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) StartK8sSync(ctx context.Context, config *models.StartK8sSyncRequest) error {
	return nil
}

func (f *fakeCmdbService) StopK8sSync(ctx context.Context) error {
	return nil
}

func (f *fakeCmdbService) Update(ctx context.Context, id string, req *models.UpdateCIRequest) (*models.CI, error) {
	return &models.CI{}, nil
}

func (f *fakeCmdbService) Search(ctx context.Context, tenantID, query, domain string) ([]models.CI, error) {
	return []models.CI{}, nil
}

func (f *fakeCmdbService) GenerateRecommendations(ctx context.Context, tenantID string, reqType *models.RecommendationType, limit int) (*models.RecommendationResult, error) {
	return &models.RecommendationResult{}, nil
}

var _ service.ServiceInterface = (*fakeCmdbService)(nil)
=======
type fakecmdbService struct{}

func (f *fakecmdbService) BatchCreate(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) ((*models.BatchResult, error)) {
	return &models.BatchResult{}, nil
}

func (f *fakecmdbService) BatchDelete(ctx context.Context, ids []string, tenantID string) ((*models.BatchResult, error)) {
	return &models.BatchResult{}, nil
}

func (f *fakecmdbService) BatchQuery(ctx context.Context, q *models.BatchQueryRequest, tenantID string) (([]models.CI, int, error)) {
	return []models.CI{}, 0, nil
}

func (f *fakecmdbService) BatchUpdate(ctx context.Context, items []models.BatchUpdateItem, tenantID string) ((*models.BatchResult, error)) {
	return &models.BatchResult{}, nil
}

func (f *fakecmdbService) Create(ctx context.Context, req *models.CreateCIRequest) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) CreateRelation(ctx context.Context, req *models.CreateRelationRequest) ((*models.CIRelation, error)) {
	return &models.CIRelation{}, nil
}

func (f *fakecmdbService) Delete(ctx context.Context, id string) ((bool, error)) {
	return false, nil
}

func (f *fakecmdbService) DeleteRelation(ctx context.Context, relationID string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakecmdbService) ExecuteScript(ctx context.Context, req *models.ScriptExecRequest) ((*models.ScriptExecResult, error)) {
	return &models.ScriptExecResult{}, nil
}

func (f *fakecmdbService) ExportCI(ctx context.Context, id string, tenantID string) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) ((*models.ExportResult, error)) {
	return &models.ExportResult{}, nil
}

func (f *fakecmdbService) Get(ctx context.Context, id string) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) GetByCiId(ctx context.Context, ciID string, tenantID *string) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) GetCurrentVersion(ctx context.Context, ciID string) ((*models.CIVersion, error)) {
	return &models.CIVersion{}, nil
}

func (f *fakecmdbService) GetHost(ctx context.Context, ciID string) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) (([]models.CIRelation, error)) {
	return []models.CIRelation{}, nil
}

func (f *fakecmdbService) GetRelations(ctx context.Context, ciID string) (([]models.CIRelation, error)) {
	return []models.CIRelation{}, nil
}

func (f *fakecmdbService) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) (([]models.CIRelation, error)) {
	return []models.CIRelation{}, nil
}

func (f *fakecmdbService) GetTopology(ctx context.Context, ciType *string, depth *int, tenantID string) ((*models.TopologyResult, error)) {
	return &models.TopologyResult{}, nil
}

func (f *fakecmdbService) GetVersions(ctx context.Context, ciID string) (([]models.CIVersion, error)) {
	return []models.CIVersion{}, nil
}

func (f *fakecmdbService) Health(ctx context.Context) ((*models.HealthStatus, error)) {
	return &models.HealthStatus{}, nil
}

func (f *fakecmdbService) ImportCIs(ctx context.Context, cis []any, tenantID string, skipDuplicates bool, createdBy string) ((*models.ExportResult, error)) {
	return &models.ExportResult{}, nil
}

func (f *fakecmdbService) List(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) (([]models.CI, int, error)) {
	return []models.CI{}, 0, nil
}

func (f *fakecmdbService) ListCICDResources(ctx context.Context, status *string, limit, offset int) (([]models.CICDResource, int, error)) {
	return []models.CICDResource{}, 0, nil
}

func (f *fakecmdbService) ListHosts(ctx context.Context, status *string, tags *string, limit, offset int) (([]models.CI, int, error)) {
	return []models.CI{}, 0, nil
}

func (f *fakecmdbService) ListK8sResources(ctx context.Context, kind *string, namespace *string, limit, offset int) (([]models.K8sResource, int, error)) {
	return []models.K8sResource{}, 0, nil
}

func (f *fakecmdbService) RestoreToVersion(ctx context.Context, ciID string, version int, user string, tenantID string) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) StartK8sSync(ctx context.Context, config *models.StartK8sSyncRequest) (error) {
	return nil
}

func (f *fakecmdbService) StopK8sSync(ctx context.Context) (error) {
	return nil
}

func (f *fakecmdbService) Update(ctx context.Context, id string, req *models.UpdateCIRequest) ((*models.CI, error)) {
	return &models.CI{}, nil
}

func (f *fakecmdbService) Search(ctx context.Context, tenantID, query, domain string) (([]models.CI, error)) {
	return []models.CI{}, nil
}

func (f *fakecmdbService) GenerateRecommendations(ctx context.Context, tenantID string, reqType *models.RecommendationType, limit int) ((*models.RecommendationResult, error)) {
	return &models.RecommendationResult{}, nil
}

var _ service.ServiceInterface = (*fakecmdbService)(nil)
>>>>>>> Stashed changes


func Test_Handler_Handler_RegisterRoutes(t *testing.T) {
}

func TestCMDB_Handler_CreateCI(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateCI(c)
	if w.Code >= 500 {
		t.Fatalf("CreateCI: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetCI(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCI(c)
	if w.Code >= 500 {
		t.Fatalf("GetCI: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetCIByID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCIByID(c)
	if w.Code >= 500 {
		t.Fatalf("GetCIByID: got %d", w.Code)
	}
}

func TestCMDB_Handler_UpdateCI(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateCI(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateCI: got %d", w.Code)
	}
}

func TestCMDB_Handler_DeleteCI(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteCI(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteCI: got %d", w.Code)
	}
}

func TestCMDB_Handler_ListCIs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCIs(c)
	if w.Code >= 500 {
		t.Fatalf("ListCIs: got %d", w.Code)
	}
}

func TestCMDB_Handler_BatchCreate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().BatchCreate(c)
	if w.Code >= 500 {
		t.Fatalf("BatchCreate: got %d", w.Code)
	}
}

func TestCMDB_Handler_BatchUpdate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().BatchUpdate(c)
	if w.Code >= 500 {
		t.Fatalf("BatchUpdate: got %d", w.Code)
	}
}

func TestCMDB_Handler_BatchDelete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().BatchDelete(c)
	if w.Code >= 500 {
		t.Fatalf("BatchDelete: got %d", w.Code)
	}
}

func TestCMDB_Handler_BatchQuery(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().BatchQuery(c)
	if w.Code >= 500 {
		t.Fatalf("BatchQuery: got %d", w.Code)
	}
}

func TestCMDB_Handler_ExportCI(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ExportCI(c)
	if w.Code >= 500 {
		t.Fatalf("ExportCI: got %d", w.Code)
	}
}

func TestCMDB_Handler_ExportAllCIs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ExportAllCIs(c)
	if w.Code >= 500 {
		t.Fatalf("ExportAllCIs: got %d", w.Code)
	}
}

func TestCMDB_Handler_ImportCIs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ImportCIs(c)
	if w.Code >= 500 {
		t.Fatalf("ImportCIs: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetRelations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRelations(c)
	if w.Code >= 500 {
		t.Fatalf("GetRelations: got %d", w.Code)
	}
}

func TestCMDB_Handler_CreateRelation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRelation(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRelation: got %d", w.Code)
	}
}

func TestCMDB_Handler_DeleteRelation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRelation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRelation: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetVersions(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersions: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetCurrentVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetCurrentVersion(c)
	if w.Code >= 500 {
		t.Fatalf("GetCurrentVersion: got %d", w.Code)
	}
}

func TestCMDB_Handler_RestoreVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RestoreVersion(c)
	if w.Code >= 500 {
		t.Fatalf("RestoreVersion: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetTopology(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTopology(c)
	if w.Code >= 500 {
		t.Fatalf("GetTopology: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetServiceDependencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetServiceDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceDependencies: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetImpactAnalysis(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetImpactAnalysis(c)
	if w.Code >= 500 {
		t.Fatalf("GetImpactAnalysis: got %d", w.Code)
	}
}

func TestCMDB_Handler_Health(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Health(c)
	if w.Code >= 500 {
		t.Fatalf("Health: got %d", w.Code)
	}
}

func TestCMDB_Handler_ListHosts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListHosts(c)
	if w.Code >= 500 {
		t.Fatalf("ListHosts: got %d", w.Code)
	}
}

func TestCMDB_Handler_GetHost(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetHost(c)
	if w.Code >= 500 {
		t.Fatalf("GetHost: got %d", w.Code)
	}
}

func TestCMDB_Handler_ListK8sResources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListK8sResources(c)
	if w.Code >= 500 {
		t.Fatalf("ListK8sResources: got %d", w.Code)
	}
}

func TestCMDB_Handler_StartK8sSync(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartK8sSync(c)
	if w.Code >= 500 {
		t.Fatalf("StartK8sSync: got %d", w.Code)
	}
}

func TestCMDB_Handler_StopK8sSync(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StopK8sSync(c)
	if w.Code >= 500 {
		t.Fatalf("StopK8sSync: got %d", w.Code)
	}
}

func TestCMDB_Handler_ListCICDResources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListCICDResources(c)
	if w.Code >= 500 {
		t.Fatalf("ListCICDResources: got %d", w.Code)
	}
}

func TestCMDB_Handler_ExecuteScript(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ExecuteScript(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteScript: got %d", w.Code)
	}
}
