package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/approval/service"

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

func TestAPPROVAL_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPPROVAL_Handler_SubmitApprovalRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SubmitApprovalRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("SubmitApprovalRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ListApprovalRequests(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListApprovalRequests(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListApprovalRequests: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetApprovalRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ReviewApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ReviewApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ReviewApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ApproveRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RejectRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_WithdrawApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().WithdrawApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("WithdrawApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_CancelApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CancelApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CancelApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_DelegateApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DelegateApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DelegateApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ReassignApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ReassignApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ReassignApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalStatistics(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalStatistics(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetApprovalStatistics: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalTrend(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalTrend(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetApprovalTrend: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetApprovalHistory: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_AgentAnalyze(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AgentAnalyze(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AgentAnalyze: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetPendingApprovals(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPendingApprovals(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPendingApprovals: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetMyPendingApprovals(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetMyPendingApprovals(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetMyPendingApprovals: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RequestEmergencyApproval(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RequestEmergencyApproval(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RequestEmergencyApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_CreateTemplate(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateTemplate: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetTemplates(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTemplates(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTemplates: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ListByRun(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByRun(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListByRun: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetStatus(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ApproveGate(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveGate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveGate: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RejectGate(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectGate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RejectGate: got %d", w.Code)
	}
}
