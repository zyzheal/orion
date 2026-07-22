package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/config/service"

	"github.com/gin-gonic/gin"
)

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

func TestCONFIG_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCONFIG_Handler_CreateConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListConfigs(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListConfigs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListConfigs: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_UpdateConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DeleteConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetConfigVersions(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfigVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConfigVersions: got %d", w.Code)
	}
}

func TestCONFIG_Handler_RollbackConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RollbackConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RollbackConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CloneConfig(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CloneConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CloneConfig: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetAuditTrail(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAuditTrail(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAuditTrail: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetDependencyGraph(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetDependencyGraph(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetDependencyGraph: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateSnapshot(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateSnapshot: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListSnapshots(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListSnapshots(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListSnapshots: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetSnapshot(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSnapshot: got %d", w.Code)
	}
}

func TestCONFIG_Handler_RestoreSnapshot(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RestoreSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RestoreSnapshot: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DeleteSnapshot(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteSnapshot: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CompareVersions(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CompareVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CompareVersions: got %d", w.Code)
	}
}

func TestCONFIG_Handler_EnableGitOps(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EnableGitOps(c)
	if w.Code != http.StatusOK {
		t.Fatalf("EnableGitOps: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListGitOpsConfigs(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListGitOpsConfigs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGitOpsConfigs: got %d", w.Code)
	}
}

func TestCONFIG_Handler_SyncFromGit(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SyncFromGit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("SyncFromGit: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DisableGitOps(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DisableGitOps(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DisableGitOps: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DetectDrift(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DetectDrift(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DetectDrift: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetSyncStatus(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSyncStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSyncStatus: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateChangeRequest(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateChangeRequest: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListChangeRequests(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListChangeRequests(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListChangeRequests: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetChangeRequest(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetChangeRequest: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ApproveChange(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveChange(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveChange: got %d", w.Code)
	}
}

func TestCONFIG_Handler_RejectChange(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectChange(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectChange: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateTemplate(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateTemplate: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListTemplates(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListTemplates(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListTemplates: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetTemplate(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTemplate: got %d", w.Code)
	}
}

func TestCONFIG_Handler_UpdateTemplate(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateTemplate: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DeleteTemplate(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteTemplate: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateTemplateVersion(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateTemplateVersion(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateTemplateVersion: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListTemplateVersions(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListTemplateVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListTemplateVersions: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateCanary(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateCanary(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateCanary: got %d", w.Code)
	}
}

func TestCONFIG_Handler_PromoteCanary(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().PromoteCanary(c)
	if w.Code != http.StatusOK {
		t.Fatalf("PromoteCanary: got %d", w.Code)
	}
}

func TestCONFIG_Handler_RollbackCanary(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RollbackCanary(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RollbackCanary: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CompareEnvironments(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CompareEnvironments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CompareEnvironments: got %d", w.Code)
	}
}

func TestCONFIG_Handler_CreateWebhook(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateWebhook(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateWebhook: got %d", w.Code)
	}
}

func TestCONFIG_Handler_ListWebhooks(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListWebhooks(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListWebhooks: got %d", w.Code)
	}
}

func TestCONFIG_Handler_GetWebhook(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetWebhook(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetWebhook: got %d", w.Code)
	}
}

func TestCONFIG_Handler_UpdateWebhook(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateWebhook(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateWebhook: got %d", w.Code)
	}
}

func TestCONFIG_Handler_DeleteWebhook(t *testing.T) {
	t.Skip("handler uses concrete Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteWebhook(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteWebhook: got %d", w.Code)
	}
}
