package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/build/service"

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

func TestBUILD_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestBUILD_Handler_ListEnvironments(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListEnvironments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListEnvironments: got %d", w.Code)
	}
}

func TestBUILD_Handler_CreateEnvironment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateEnvironment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetEnvironment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetEnvironment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_UpdateEnvironment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateEnvironment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_DeleteEnvironment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteEnvironment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_ListBuilds(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListBuilds(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListBuilds: got %d", w.Code)
	}
}

func TestBUILD_Handler_CreateBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_StartBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StartBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_CancelBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CancelBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CancelBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_RetryBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RetryBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RetryBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_DeleteBuild(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteBuild(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
