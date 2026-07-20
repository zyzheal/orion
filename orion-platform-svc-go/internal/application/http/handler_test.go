package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/application/commands"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&commands.CommandBus{})
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

func TestAPPLICATION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPPLICATION_Handler_DispatchPipelineActivate(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchPipelineActivate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchPipelineActivate: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchPipelineDeactivate(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchPipelineDeactivate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchPipelineDeactivate: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchPipelineUpdateYAML(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchPipelineUpdateYAML(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchPipelineUpdateYAML: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchApprovalCreate(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchApprovalCreate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchApprovalCreate: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchApprovalApproveLevel(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchApprovalApproveLevel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchApprovalApproveLevel: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchApprovalRejectLevel(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchApprovalRejectLevel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchApprovalRejectLevel: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchApprovalCancel(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchApprovalCancel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchApprovalCancel: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchFeatureFlagToggle(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchFeatureFlagToggle(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchFeatureFlagToggle: got %d", w.Code)
	}
}

func TestAPPLICATION_Handler_DispatchFeatureFlagUpdateRollout(t *testing.T) {
	t.Skip("handler uses concrete *commands.CommandBus type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DispatchFeatureFlagUpdateRollout(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DispatchFeatureFlagUpdateRollout: got %d", w.Code)
	}
}
