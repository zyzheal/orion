package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/chaos-gateway/service"

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

func TestCHAOS_GATEWAY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHAOS_GATEWAY_Handler_GetScenarios(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetScenarios(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetScenarios: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ListExperiments(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListExperiments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_CreateExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_UpdateExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_DeleteExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_StartExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StartExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_StopExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StopExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StopExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_PauseExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().PauseExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("PauseExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ResumeExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ResumeExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ResumeExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetResults(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetResults(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetResults: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetLogs(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLogs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ScheduleExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ScheduleExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ScheduleExperiment: got %d", w.Code)
	}
}
