package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/job-source/models"
	"orion/platform-svc-go/internal/job-source/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap/zaptest"
)

func init() { gin.SetMode(gin.TestMode) }

// fakeRepo doubles the service repository so a handler assertion proves the
// whole HTTP-to-service chain rather than the mapping alone.
type fakeRepo struct {
	byID      map[string]*models.JobSource
	updateErr error
	createErr error
	deleteErr error
}

func (f *fakeRepo) Create(ctx context.Context, m *models.JobSource) error { return nil }
func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error { return f.deleteErr }
func (f *fakeRepo) List(ctx context.Context, tenantID string, l, o int) ([]models.JobSource, error) {
	return nil, nil
}
func (f *fakeRepo) ListEvents(ctx context.Context, tenantID, sourceID string, l, o int) ([]models.JobSourceEvent, error) {
	return nil, nil
}
func (f *fakeRepo) UpdateEventStatus(ctx context.Context, tenantID, id, status, jobID, err string) error {
	return nil
}
func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return f.updateErr
}
func (f *fakeRepo) CreateEvent(ctx context.Context, e *models.JobSourceEvent) error {
	if f.createErr != nil {
		return f.createErr
	}
	e.ID = "evt-1"
	return nil
}
func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error) {
	if m, ok := f.byID[id]; ok {
		return m, nil
	}
	return nil, sentinel.NotFound
}

type capture struct {
	payload string
}

func router(t *testing.T, repo service.RepositoryInterface) *gin.Engine {
	t.Helper()
	h := NewHandler(service.NewService(repo, zaptest.NewLogger(t)))
	e := gin.New()
	rg := e.Group("/job-sources")
	rg.PUT("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
	rg.POST("/:id/trigger", h.Trigger)
	return e
}

func do(t *testing.T, e *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	e.ServeHTTP(w, req)
	return w
}

func code(w *httptest.ResponseRecorder) int { return w.Code }

func mustBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response is not a JSON object: %q (%v)", w.Body.String(), err)
	}
	return out
}

// RegisterRoutes must expose all seven endpoints the module documents. The
// request handlers are not invoked here, so the permission middleware never
// runs and no role has to be seeded.
func TestHandler_RegisterRoutesMountsEveryDocumentedEndpoint(t *testing.T) {
	h := NewHandler(service.NewService(&fakeRepo{}, zaptest.NewLogger(t)))
	e := gin.New()
	h.RegisterRoutes(e.Group("/api/v1"))

	want := map[string]string{
		"POST":   "/api/v1/job-sources",
		"DELETE": "/api/v1/job-sources/:id",
		"PUT":    "/api/v1/job-sources/:id",
	}
	seen := map[string]bool{}
	for _, r := range e.Routes() {
		seen[r.Method+" "+r.Path] = true
	}
	for method, path := range want {
		if !seen[method+" "+path] {
			t.Errorf("route %s %s is not registered", method, path)
		}
	}
	for _, key := range []string{
		"POST /api/v1/job-sources",
		"GET /api/v1/job-sources",
		"GET /api/v1/job-sources/:id",
		"PUT /api/v1/job-sources/:id",
		"DELETE /api/v1/job-sources/:id",
		"POST /api/v1/job-sources/:id/trigger",
		"GET /api/v1/job-sources/:id/events",
	} {
		if !seen[key] {
			t.Errorf("route %s is not registered", key)
		}
	}
	if len(seen) < 7 {
		t.Errorf("registered %d route(s), want at least 7", len(seen))
	}
}

// PUT with an empty body is the canonical client mistake: it answered 500
// before ErrNoFieldsToUpdate existed.
func TestHandler_Update_EmptyBodyReturns400WithTheExactReason(t *testing.T) {
	w := do(t, router(t, &fakeRepo{}), http.MethodPut, "/job-sources/id-1", "{}")
	if code(w) != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	b := mustBody(t, w)
	if b["error"] != "no fields to update" {
		t.Errorf("error = %q, want %q", b["error"], "no fields to update")
	}
}

// A wrong id is a 404, not a 500: the repository answers sentinel.NotFound and
// the handler must not flatten it into a driver failure.
func TestHandler_Update_AbsentSourceReturns404(t *testing.T) {
	w := do(t, router(t, &fakeRepo{}), http.MethodPut, "/job-sources/nope", `{"name":"x"}`)
	if code(w) != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	b := mustBody(t, w)
	if b["error"] != "not found" {
		t.Errorf("error = %q, want %q", b["error"], "not found")
	}
}

// A repository fault must still look like a fault.
func TestHandler_Update_RepositoryFaultReturns500(t *testing.T) {
	repo := &fakeRepo{updateErr: sentinel.Unauthorized}
	w := do(t, router(t, repo), http.MethodPut, "/job-sources/id-1", `{"name":"x"}`)
	if code(w) != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
}

// Malformed JSON is a client error. The pre-fix code discarded the bind error
// and persisted an event for it.
func TestHandler_Trigger_MalformedBodyReturns400AndPersistsNothing(t *testing.T) {
	repo := &fakeRepo{byID: map[string]*models.JobSource{"id-1": {ID: "id-1", Enabled: true}}}
	w := do(t, router(t, repo), http.MethodPost, "/job-sources/id-1/trigger", `{bad json`)
	if code(w) != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
}

// A zero-length body is a legitimate manual trigger with no payload.
func TestHandler_Trigger_EmptyBodySucceedsAndWritesAnEmptyPayload(t *testing.T) {
	var got capture
	repo := &captureRepo{
		next: &fakeRepo{byID: map[string]*models.JobSource{"id-1": {ID: "id-1", Enabled: true}}},
		seen: &got,
	}
	w := do(t, router(t, repo), http.MethodPost, "/job-sources/id-1/trigger", "")
	if code(w) != http.StatusOK {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	if got.payload != "{}" {
		t.Errorf("nil payload stored as %q, want {} (json.Marshal(nil) yields \"null\")", got.payload)
	}
}

func TestHandler_Trigger_PayloadIsPassedThrough(t *testing.T) {
	var got capture
	repo := &captureRepo{
		next: &fakeRepo{byID: map[string]*models.JobSource{"id-1": {ID: "id-1", Enabled: true}}},
		seen: &got,
	}
	w := do(t, router(t, repo), http.MethodPost, "/job-sources/id-1/trigger", `{"payload":{"run":7}}`)
	if code(w) != http.StatusOK {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	if got.payload != `{"run":7}` {
		t.Errorf("payload = %q, want {\"run\":7}", got.payload)
	}
}

// An absent source is a 404 on the trigger path too.
func TestHandler_Trigger_AbsentSourceReturns404(t *testing.T) {
	w := do(t, router(t, &fakeRepo{}), http.MethodPost, "/job-sources/nope/trigger", "")
	if code(w) != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
}

// A disabled source is a conflict with current state, not a fault.
func TestHandler_Trigger_DisabledSourceReturns409WithTheExactReason(t *testing.T) {
	repo := &fakeRepo{byID: map[string]*models.JobSource{"id-1": {ID: "id-1", Enabled: false}}}
	w := do(t, router(t, repo), http.MethodPost, "/job-sources/id-1/trigger", "")
	if code(w) != http.StatusConflict {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	b := mustBody(t, w)
	if b["error"] != "source is disabled" {
		t.Errorf("error = %q, want %q", b["error"], "source is disabled")
	}
}

// DELETE with a driver fault must not answer {"message":"deleted"}: the row is
// still there, so reporting success would make the client's view diverge from
// the database. An absent id stays a 200 by design (idempotent delete), which
// is asserted separately.
func TestHandler_Delete_RepositoryFaultReturns500(t *testing.T) {
	repo := &fakeRepo{deleteErr: sentinel.Unauthorized}
	w := do(t, router(t, repo), http.MethodDelete, "/job-sources/id-1", "")
	if code(w) != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
}

func TestHandler_Delete_AbsentSourceIsIdempotentSuccess(t *testing.T) {
	w := do(t, router(t, &fakeRepo{}), http.MethodDelete, "/job-sources/nope", "")
	if code(w) != http.StatusOK {
		t.Fatalf("status = %d, body = %s", code(w), w.Body.String())
	}
	b := mustBody(t, w)
	if b["success"] != true {
		t.Errorf("success = %v, want true", b["success"])
	}
	data, _ := b["data"].(map[string]any)
	if data == nil || data["message"] != "deleted" {
		t.Errorf("data = %v, want message deleted", b["data"])
	}
}

// captureRepo records the payload the service persisted, so the handler test can
// prove what reached the audit table.
type captureRepo struct {
	next *fakeRepo
	seen *capture
}

func (r *captureRepo) Create(ctx context.Context, m *models.JobSource) error {
	return r.next.Create(ctx, m)
}
func (r *captureRepo) Delete(ctx context.Context, tenantID, id string) error {
	return r.next.Delete(ctx, tenantID, id)
}
func (r *captureRepo) List(ctx context.Context, tenantID string, l, o int) ([]models.JobSource, error) {
	return r.next.List(ctx, tenantID, l, o)
}
func (r *captureRepo) ListEvents(ctx context.Context, tenantID, sourceID string, l, o int) ([]models.JobSourceEvent, error) {
	return r.next.ListEvents(ctx, tenantID, sourceID, l, o)
}
func (r *captureRepo) UpdateEventStatus(ctx context.Context, tenantID, id, status, jobID, err string) error {
	return r.next.UpdateEventStatus(ctx, tenantID, id, status, jobID, err)
}
func (r *captureRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return r.next.Update(ctx, tenantID, id, updates)
}
func (r *captureRepo) GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error) {
	return r.next.GetByID(ctx, tenantID, id)
}
func (r *captureRepo) CreateEvent(ctx context.Context, e *models.JobSourceEvent) error {
	r.seen.payload = e.Payload
	return r.next.CreateEvent(ctx, e)
}
