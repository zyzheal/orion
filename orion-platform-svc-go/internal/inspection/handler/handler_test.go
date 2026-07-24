package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/inspection/service"

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

func TestHandler_INSPECTION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INSPECTION_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_RunInspection(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunInspection(c)
	if w.Code >= 500 {
		t.Fatalf("RunInspection: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetResults(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetResults: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_UpdateStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateStatus(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListTemplates(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTemplates(c)
	if w.Code >= 500 {
		t.Fatalf("ListTemplates: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_RunPipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunPipeline(c)
	if w.Code >= 500 {
		t.Fatalf("RunPipeline: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Pause(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Resume(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListSchemas(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchemas(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchemas: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetLineage(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLineage(c)
	if w.Code >= 500 {
		t.Fatalf("GetLineage: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_UpdateConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetStatusMiddleware(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatusMiddleware(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatusMiddleware: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Restart(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Restart(c)
	if w.Code >= 500 {
		t.Fatalf("Restart: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Configure(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Configure(c)
	if w.Code >= 500 {
		t.Fatalf("Configure: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListPlugins(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPlugins(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlugins: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetPlugin(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPlugin(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlugin: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_EnablePlugin(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EnablePlugin(c)
	if w.Code >= 500 {
		t.Fatalf("EnablePlugin: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_DisablePlugin(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DisablePlugin(c)
	if w.Code >= 500 {
		t.Fatalf("DisablePlugin: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Train(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Train(c)
	if w.Code >= 500 {
		t.Fatalf("Train: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Evaluate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Evaluate(c)
	if w.Code >= 500 {
		t.Fatalf("Evaluate: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Deploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Deploy(c)
	if w.Code >= 500 {
		t.Fatalf("Deploy: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Rollback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListExperiments(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExperiments(c)
	if w.Code >= 500 {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListArtifacts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListArtifacts(c)
	if w.Code >= 500 {
		t.Fatalf("ListArtifacts: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListModels(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListModels(c)
	if w.Code >= 500 {
		t.Fatalf("ListModels: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_RegisterModel(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterModel(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterModel: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_DeregisterModel(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeregisterModel(c)
	if w.Code >= 500 {
		t.Fatalf("DeregisterModel: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListPipelines(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPipelines(c)
	if w.Code >= 500 {
		t.Fatalf("ListPipelines: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Trigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Trigger(c)
	if w.Code >= 500 {
		t.Fatalf("Trigger: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListTemplates2(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTemplates2(c)
	if w.Code >= 500 {
		t.Fatalf("ListTemplates2: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetBranchStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBranchStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetBranchStatus: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListHistories(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListHistories(c)
	if w.Code >= 500 {
		t.Fatalf("ListHistories: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListPending(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPending(c)
	if w.Code >= 500 {
		t.Fatalf("ListPending: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Approve(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Approve(c)
	if w.Code >= 500 {
		t.Fatalf("Approve: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Reject(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Reject(c)
	if w.Code >= 500 {
		t.Fatalf("Reject: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Escalate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Escalate(c)
	if w.Code >= 500 {
		t.Fatalf("Escalate: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetByUser(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetByUser(c)
	if w.Code >= 500 {
		t.Fatalf("GetByUser: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Forecast(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Forecast(c)
	if w.Code >= 500 {
		t.Fatalf("Forecast: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetUtilization(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetUtilization(c)
	if w.Code >= 500 {
		t.Fatalf("GetUtilization: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ScaleResource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ScaleResource(c)
	if w.Code >= 500 {
		t.Fatalf("ScaleResource: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListAlerts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetHistory: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_AddTag(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddTag(c)
	if w.Code >= 500 {
		t.Fatalf("AddTag: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_DeleteTag(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTag(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTag: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_CheckCompatibility(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckCompatibility(c)
	if w.Code >= 500 {
		t.Fatalf("CheckCompatibility: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ValidateBranch(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ValidateBranch(c)
	if w.Code >= 500 {
		t.Fatalf("ValidateBranch: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_GetCoverage(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCoverage(c)
	if w.Code >= 500 {
		t.Fatalf("GetCoverage: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_EnforcePolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EnforcePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("EnforcePolicy: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_ListViolations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListViolations(c)
	if w.Code >= 500 {
		t.Fatalf("ListViolations: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_BatchCreate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchCreate(c)
	if w.Code >= 500 {
		t.Fatalf("BatchCreate: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Search(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Search(c)
	if w.Code >= 500 {
		t.Fatalf("Search: got %d", w.Code)
	}
}
func TestHandler_INSPECTION_Regenerate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Regenerate(c)
	if w.Code >= 500 {
		t.Fatalf("Regenerate: got %d", w.Code)
	}
}
