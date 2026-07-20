package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact-ops/service"

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

func TestARTIFACT_OPS_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_OPS_Handler_TrackOperation(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().TrackOperation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("TrackOperation: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetOperationHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetOperationHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetOperationHistory: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetArtifactStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetArtifactStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetArtifactStats: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_Cleanup(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Cleanup(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Cleanup: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_ScanArtifact(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ScanArtifact(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ScanArtifact: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetScanReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetScanReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetScanReport: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetArtifactScanReports(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetArtifactScanReports(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetArtifactScanReports: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DetectMalicious(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DetectMalicious(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DetectMalicious: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DefineRetentionPolicy(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DefineRetentionPolicy(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DefineRetentionPolicy: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_EvaluateRetention(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EvaluateRetention(c)
	if w.Code != http.StatusOK {
		t.Fatalf("EvaluateRetention: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetRetentionReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRetentionReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetRetentionReport: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_ListPolicies(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPolicies(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListPolicies: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DeletePolicy(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeletePolicy(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeletePolicy: got %d", w.Code)
	}
}
