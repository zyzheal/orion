package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/worker-dispatcher/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.WorkerDispatcher{})
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

func TestWORKERDISPATCHER_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestWORKERDISPATCHER_Handler_CreatePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/api/v1/worker/policies", gin.H{
		"name": "default", "type": "round_robin",
	}, nil)
	newHandler().CreatePolicy(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreatePolicy: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_ListPolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/policies", nil, nil)
	newHandler().ListPolicies(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListPolicies: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_GetPolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/policies/policy-1", nil, gin.H{"id": "policy-1"})
	newHandler().GetPolicy(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPolicy: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_UpdatePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodPut, "/api/v1/worker/policies/policy-1", gin.H{
		"name": "updated",
	}, gin.H{"id": "policy-1"})
	newHandler().UpdatePolicy(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdatePolicy: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_CreateCapability(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/api/v1/worker/capabilities", gin.H{
		"worker_id": "u1", "worker_type": "user", "skill": "golang",
	}, nil)
	newHandler().CreateCapability(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateCapability: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_ListCapabilities(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/capabilities", nil, nil)
	newHandler().ListCapabilities(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListCapabilities: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_GetCapabilitiesByWorker(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/capabilities/u1", nil, gin.H{"workerId": "u1"})
	newHandler().GetCapabilitiesByWorker(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetCapabilitiesByWorker: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_Dispatch(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/api/v1/worker/dispatch", gin.H{
		"target_type": "ticket", "target_id": "t-1", "policy_type": "skill_match",
	}, nil)
	newHandler().Dispatch(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Dispatch: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_GetAssignment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/assignments/t-1", nil, gin.H{"targetId": "t-1"})
	newHandler().GetAssignment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAssignment: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_CompleteAssignment(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/api/v1/worker/assignments/a-1/complete", nil, gin.H{"id": "a-1"})
	newHandler().CompleteAssignment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CompleteAssignment: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_GetWorkerLoad(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/api/v1/worker/load/u1", nil, gin.H{"workerId": "u1"})
	newHandler().GetWorkerLoad(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetWorkerLoad: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_CreatePolicy_BadBody(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/api/v1/worker/policies", "not json", nil)
	newHandler().CreatePolicy(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreatePolicy bad body: got %d", w.Code)
	}
}

func TestWORKERDISPATCHER_Handler_DeleteCapability_NoSkill(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/api/v1/worker/capabilities/u1", nil, gin.H{"workerId": "u1"})
	newHandler().DeleteCapability(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("DeleteCapability no skill: got %d", w.Code)
	}
}
