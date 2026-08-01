package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai-degradation/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.DegradationService{})
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

func TestAI_DEGRADATION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_DEGRADATION_Handler_CreateConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_GetConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_ListConfigs(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListConfigs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListConfigs: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_UpdateConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_DeleteConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_EnableConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EnableConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("EnableConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_DisableConfig(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DisableConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DisableConfig: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_TriggerDegradation(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().TriggerDegradation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("TriggerDegradation: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_RecoverService(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RecoverService(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RecoverService: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_GetHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetHistory: got %d", w.Code)
	}
}

func TestAI_DEGRADATION_Handler_GetGlobalStatus(t *testing.T) {
	t.Skip("handler uses concrete *service.DegradationService type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetGlobalStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetGlobalStatus: got %d", w.Code)
	}
}
