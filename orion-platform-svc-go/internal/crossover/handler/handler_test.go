package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/crossover/dispatcher"
	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/registry"
	"orion/platform-svc-go/internal/crossover/router"
	"orion/platform-svc-go/internal/crossover/service"
)

// fakeCallRepo satisfies service.RepositoryInterface (call records).
type fakeCallRepo struct {
	calls map[string]*models.CrossoverCall
}

func newFakeCallRepo() *fakeCallRepo {
	return &fakeCallRepo{calls: make(map[string]*models.CrossoverCall)}
}

func (r *fakeCallRepo) Create(_ context.Context, call *models.CrossoverCall) error {
	if call.ID == "" {
		call.ID = "test-id"
	}
	r.calls[call.ID] = call
	return nil
}
func (r *fakeCallRepo) Get(_ context.Context, _, id string) (*models.CrossoverCall, error) {
	if c, ok := r.calls[id]; ok {
		return c, nil
	}
	return nil, nil
}
func (r *fakeCallRepo) UpdateResult(_ context.Context, _, id string, _ *models.CallResultObj) error {
	if c, ok := r.calls[id]; ok {
		c.Status = string("succeeded")
	}
	return nil
}
func (r *fakeCallRepo) List(_ context.Context, tenantID string, _ *service.ListOptions) ([]models.CrossoverCall, error) {
	out := make([]models.CrossoverCall, 0)
	for _, c := range r.calls {
		if c.TenantID == tenantID {
			out = append(out, *c)
		}
	}
	return out, nil
}
func (r *fakeCallRepo) ListByTarget(_ context.Context, tenantID, _ string, _ *service.ListOptions) ([]models.CrossoverCall, error) {
	out := make([]models.CrossoverCall, 0)
	for _, c := range r.calls {
		if c.TenantID == tenantID {
			out = append(out, *c)
		}
	}
	return out, nil
}
func (r *fakeCallRepo) Delete(_ context.Context, _, id string) error {
	delete(r.calls, id)
	return nil
}

// fakeOpRepo satisfies registry.RepositoryInterface (operation registry).
type fakeOpRepo struct {
	ops map[string]*models.CallOperation
}

func newFakeOpRepo() *fakeOpRepo {
	return &fakeOpRepo{ops: make(map[string]*models.CallOperation)}
}

func (r *fakeOpRepo) key(tenantID, module, name string) string {
	return tenantID + ":" + module + ":" + name
}
func (r *fakeOpRepo) Create(_ context.Context, op *models.CallOperation) error {
	r.ops[r.key(op.TenantID, op.Module, op.Name)] = op
	return nil
}
func (r *fakeOpRepo) Delete(_ context.Context, tenantID, module, name string) error {
	delete(r.ops, r.key(tenantID, module, name))
	return nil
}
func (r *fakeOpRepo) Get(_ context.Context, tenantID, module, name string) (*models.CallOperation, error) {
	op, ok := r.ops[r.key(tenantID, module, name)]
	if !ok {
		return nil, nil
	}
	return op, nil
}
func (r *fakeOpRepo) ListByModule(_ context.Context, tenantID, module string) ([]models.CallOperation, error) {
	out := make([]models.CallOperation, 0)
	for _, op := range r.ops {
		if op.TenantID == tenantID && op.Module == module {
			out = append(out, *op)
		}
	}
	return out, nil
}
func (r *fakeOpRepo) List(_ context.Context, tenantID string, _ *registry.ListOptions) ([]models.CallOperation, error) {
	out := make([]models.CallOperation, 0)
	for _, op := range r.ops {
		if op.TenantID == tenantID {
			out = append(out, *op)
		}
	}
	return out, nil
}

func setup() *Handler {
	callRepo := newFakeCallRepo()
	opRepo := newFakeOpRepo()
	handlerRegistry := router.NewHandlerRegistry()
	opRegistry := registry.NewCallOperationRegistry(opRepo)
	callRouter := router.NewCallRouter(handlerRegistry, opRegistry)
	svc := service.NewCrossoverServiceWithRegistry(callRepo, handlerRegistry, opRegistry, callRouter)
	return NewHandler(svc)
}

func testCtx(w *httptest.ResponseRecorder, method, path, body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("role", "super_admin")
	var reader io.Reader
	if body != "" {
		reader = io.NopCloser(strings.NewReader(body))
	} else {
		reader = strings.NewReader("")
	}
	c.Request = httptest.NewRequest(method, path, reader)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{}
	return c
}

func testCtxParams(w *httptest.ResponseRecorder, method, path, body string, params map[string]string) *gin.Context {
	c := testCtx(w, method, path, body)
	p := make(gin.Params, 0, len(params))
	for k, v := range params {
		p = append(p, gin.Param{Key: k, Value: v})
	}
	c.Params = p
	return c
}

func TestRegisterOperation(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations",
		`{"name":"test-op","module":"test-module","description":"test","callType":"request_response"}`)
	h.RegisterOperation(c)
	if w.Code != 201 {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRegisterOperationBadRequest(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations", "invalid")
	h.RegisterOperation(c)
	if w.Code != 400 {
		t.Errorf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUnregisterOperation(t *testing.T) {
	h := setup()
	{
		w := httptest.NewRecorder()
		c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations",
			`{"name":"test-op","module":"test-module","description":"test","callType":"request_response"}`)
		h.RegisterOperation(c)
	}
	w := httptest.NewRecorder()
	c := testCtxParams(w, http.MethodDelete, "/api/v1/crossover/operations/test-module/test-op", "",
		map[string]string{"module": "test-module", "name": "test-op"})
	h.UnregisterOperation(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListOperations(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/operations", "")
	h.ListOperations(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListOperationsByModule(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/operations?module=scheduler", "")
	h.ListOperations(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetOperation(t *testing.T) {
	h := setup()
	{
		w := httptest.NewRecorder()
		c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations",
			`{"name":"test-op","module":"test-module","description":"test","callType":"request_response"}`)
		h.RegisterOperation(c)
	}
	w := httptest.NewRecorder()
	c := testCtxParams(w, http.MethodGet, "/api/v1/crossover/operations/test-module/test-op", "",
		map[string]string{"module": "test-module", "name": "test-op"})
	h.GetOperation(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInvoke(t *testing.T) {
	h := setup()
	// Register the target operation first
	{
		w := httptest.NewRecorder()
		c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations",
			`{"name":"schedule","module":"scheduler","description":"test","callType":"request_response"}`)
		h.RegisterOperation(c)
	}
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/invoke",
		`{"callType":"request_response","targetModule":"scheduler","operation":"schedule","parameters":{"id":"1"}}`)
	h.Invoke(c)
	// Without a registered handler for scheduler.schedule, Invoke returns 500 (expected).
	// Verify the response is valid JSON with an error field.
	if w.Code != 500 {
		t.Errorf("expected 500 (no handler), got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateAsyncJob(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/async",
		`{"targetModule":"scheduler","operation":"schedule","parameters":{"id":"1"}}`)
	h.CreateAsyncJob(c)
	if w.Code != 201 {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetAsyncJobNotFound(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtxParams(w, http.MethodGet, "/api/v1/crossover/async/not-exist", "",
		map[string]string{"id": "not-exist"})
	h.GetAsyncJob(c)
	if w.Code != 404 {
		t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDispatchBatch(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/batch",
		`{"calls":[{"callType":"request_response","targetModule":"scheduler","operation":"schedule"}]}`)
	h.DispatchBatch(c)
	if w.Code != 201 {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDispatchBatchEmpty(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/batch", `{"calls":[]}`)
	h.DispatchBatch(c)
	if w.Code != 201 {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDispatchBatchBadRequest(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/batch", `{"no-calls":[]}`)
	h.DispatchBatch(c)
	if w.Code != 400 {
		t.Errorf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListCalls(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/calls?limit=10&offset=0", "")
	h.ListCalls(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListCallsByTarget(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/calls?targetModule=scheduler&limit=5", "")
	h.ListCalls(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCallNotFound(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtxParams(w, http.MethodGet, "/api/v1/crossover/calls/not-found", "",
		map[string]string{"id": "not-found"})
	h.GetCall(c)
	if w.Code != 404 {
		t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCall(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtxParams(w, http.MethodDelete, "/api/v1/crossover/calls/call-123", "",
		map[string]string{"id": "call-123"})
	h.DeleteCall(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestStats(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/stats", "")
	h.Stats(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListAsyncJobs(t *testing.T) {
	h := setup()
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodGet, "/api/v1/crossover/async?status=pending", "")
	h.ListAsyncJobs(c)
	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestResponseJSON(t *testing.T) {
	h := setup()
	// Register the target operation first
	{
		w := httptest.NewRecorder()
		c := testCtx(w, http.MethodPost, "/api/v1/crossover/operations",
			`{"name":"schedule","module":"scheduler","description":"test","callType":"request_response"}`)
		h.RegisterOperation(c)
	}
	w := httptest.NewRecorder()
	c := testCtx(w, http.MethodPost, "/api/v1/crossover/invoke",
		`{"callType":"request_response","targetModule":"scheduler","operation":"schedule","parameters":{"id":"1"}}`)
	h.Invoke(c)
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("expected valid JSON response: %v", err)
	}
	// Error response should have an "error" field
	if _, ok := resp["error"]; !ok {
		t.Errorf("expected 'error' field in response, got: %v", resp)
	}
}

func TestIntParam(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{"/test", 20},
		{"/test?limit=50", 50},
		{"/test?limit=abc", 20},
	}
	for _, tt := range tests {
		w := httptest.NewRecorder()
		c := testCtx(w, http.MethodGet, tt.path, "")
		got := intParam(c, "limit", 20)
		if got != tt.want {
			t.Errorf("intParam(%q) = %d, want %d", tt.path, got, tt.want)
		}
	}
}

// Ensure all imported types are referenced.
var _ = dispatcher.AsyncJob{}
var _ = models.CrossoverCall{}
var _ = service.ListOptions{}
var _ = registry.ListOptions{}
var _ = router.HandlerRegistry{}
