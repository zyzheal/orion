package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"
	dt_service "orion/platform-svc-go/internal/digital-twin/service"

	"github.com/gin-gonic/gin"
)

// --- mockDigitalTwinRepo implements dt_service.DigitalTwinRepo ---

type mockDigitalTwinRepo struct {
	dbErr              error
	twinFn             func(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error)
	findTwinFn         func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	findAllTwinsFn     func(ctx context.Context, tenantID string) ([]models.DigitalTwin, error)
	createSnapshotFn   func(ctx context.Context, twinID, name string) (*models.Snapshot, error)
	createRecordFn     func(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error)
	recordsByTwinFn    func(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error)
	replayFn           func(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error)
	replaysByTwinFn    func(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error)
	replayByIdFn       func(ctx context.Context, tenantID, id string) (*models.ReplaySession, error)
	updateReplayFn     func(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error)
	recordingRecordsFn func(ctx context.Context, tenantID, id string) ([]interface{}, error)
}

func (m *mockDigitalTwinRepo) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	if m.twinFn != nil {
		return m.twinFn(ctx, tenantID, req)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.DigitalTwin{ID: "twin-" + req.Name, TenantID: tenantID, Name: req.Name, ServiceType: req.ServiceType, Status: "active", CreatedAt: time.Now().UTC()}, nil
}
func (m *mockDigitalTwinRepo) FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.findTwinFn != nil {
		return m.findTwinFn(ctx, tenantID, id)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.DigitalTwin{ID: id, TenantID: tenantID, Name: "twin"}, nil
}
func (m *mockDigitalTwinRepo) FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error) {
	if m.findAllTwinsFn != nil {
		return m.findAllTwinsFn(ctx, tenantID)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return []models.DigitalTwin{{ID: "t1", Name: "a"}, {ID: "t2", Name: "b"}}, nil
}
func (m *mockDigitalTwinRepo) CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error) {
	if m.createSnapshotFn != nil {
		return m.createSnapshotFn(ctx, twinID, name)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.Snapshot{ID: "snap-" + name, TwinID: twinID, Name: name, CreatedAt: time.Now().UTC()}, nil
}
func (m *mockDigitalTwinRepo) CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error) {
	if m.createRecordFn != nil {
		return m.createRecordFn(ctx, in)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.TrafficRecord{ID: "rec-" + in.TwinID, TwinID: in.TwinID, Type: in.Type, StartedAt: in.StartedAt}, nil
}
func (m *mockDigitalTwinRepo) FindTrafficRecordsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error) {
	if m.recordsByTwinFn != nil {
		return m.recordsByTwinFn(ctx, tenantID, twinID)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return nil, nil
}
func (m *mockDigitalTwinRepo) CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	if m.replayFn != nil {
		return m.replayFn(ctx, in)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.ReplaySession{ID: "replay-" + in.TwinID, Status: in.Status, StartedAt: in.StartedAt}, nil
}
func (m *mockDigitalTwinRepo) FindReplaySessionsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error) {
	if m.replaysByTwinFn != nil {
		return m.replaysByTwinFn(ctx, tenantID, twinID)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return nil, nil
}
func (m *mockDigitalTwinRepo) FindReplaySessionById(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
	if m.replayByIdFn != nil {
		return m.replayByIdFn(ctx, tenantID, id)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.ReplaySession{ID: id, Status: "running"}, nil
}
func (m *mockDigitalTwinRepo) UpdateReplaySession(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
	if m.updateReplayFn != nil {
		return m.updateReplayFn(ctx, tenantID, id, status)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return &models.ReplaySession{ID: id, Status: status}, nil
}

func (m *mockDigitalTwinRepo) GetRecordingRecordsBySessionID(ctx context.Context, tenantID, id string) ([]interface{}, error) {
	if m.recordingRecordsFn != nil {
		return m.recordingRecordsFn(ctx, tenantID, id)
	}
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return nil, nil
}

// --- helpers ---

func newHandlerWithSvc(svc *dt_service.Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	return performRequestAs("tenant-1", h, handlerFn, method, body, pathParams, queryParams)
}

// performRequestAs drives a handler for a tenant other than the default one so
// cross-tenant access paths can be exercised.
func performRequestAs(tenantID string, h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", tenantID)
	c.Set("user_id", "user-1")

	buf := new(bytes.Buffer)
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

type envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error"`
	Code    string      `json:"code"`
}

// decodeEnvelope asserts the response is a success envelope and returns the
// decoded data value. Failures print the raw body so regressions are diagnosable.
func decodeEnvelope(t *testing.T, w *httptest.ResponseRecorder) interface{} {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("invalid response envelope: %v\nbody=%s", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("expected success envelope, got code=%s error=%s\nbody=%s", env.Code, env.Error, w.Body.String())
	}
	return env.Data
}

// asObject decodes a success envelope whose data is a JSON object.
func asObject(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	data, ok := decodeEnvelope(t, w).(map[string]interface{})
	if !ok {
		t.Fatalf("expected object data, got %#v\nbody=%s", data, w.Body.String())
	}
	return data
}

// asList decodes a success envelope whose data is a JSON array.
func asList(t *testing.T, w *httptest.ResponseRecorder) []interface{} {
	t.Helper()
	data, ok := decodeEnvelope(t, w).([]interface{})
	if !ok {
		t.Fatalf("expected array data, got %#v\nbody=%s", data, w.Body.String())
	}
	return data
}

// decodeErrorEnvelope asserts the response carries the given error code.
func decodeErrorEnvelope(t *testing.T, w *httptest.ResponseRecorder, wantCode string) string {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("invalid response envelope: %v\nbody=%s", err, w.Body.String())
	}
	if env.Success {
		t.Fatalf("expected error envelope %s, got success\nbody=%s", wantCode, w.Body.String())
	}
	if env.Code != wantCode {
		t.Fatalf("expected code %s, got %s (error=%s)\nbody=%s", wantCode, env.Code, env.Error, w.Body.String())
	}
	return env.Error
}

// newSandbox provisions a sandbox through the service so handlers that key on
// /sandbox/:id have something real to operate on.
func newSandbox(t *testing.T, svc *dt_service.Service, tenantID, twinID, name string) *models.Sandbox {
	t.Helper()
	sb, err := svc.CreateSandbox(context.Background(), tenantID, models.CreateSandboxRequest{TwinID: twinID, Name: name})
	if err != nil {
		t.Fatalf("failed to provision sandbox: %v", err)
	}
	return sb
}

// ==================== Digital Twin CRUD ====================

func TestHandler_CreateTwin_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CreateTwin, "POST", models.CreateDigitalTwinRequest{
		Name:          "web-api",
		ServiceType:   "api",
		SourceService: "my-service",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateTwin_BadRequest(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	// missing required Name field
	w := performRequest(h, h.CreateTwin, "POST", models.CreateDigitalTwinRequest{ServiceType: "api"}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_ListTwins_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListTwins, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTwinState_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTwinState, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTwinState_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return nil, fmt.Errorf("twin not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTwinState, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Sandbox ====================

func TestHandler_CreateSandbox_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CreateSandbox, "POST", models.CreateSandboxRequest{
		TwinID: "twin-1",
		Name:   "test-sandbox",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	id, _ := data["id"].(string)
	if id == "" || !strings.HasPrefix(id, "sb-") {
		t.Fatalf("sandbox id must be returned so /sandbox/:id/* is reachable, got %q", id)
	}
	if tenant, _ := data["tenant_id"].(string); tenant != "tenant-1" {
		t.Fatalf("sandbox must carry the caller tenant, got %q", tenant)
	}
	if status, _ := data["status"].(string); status != "running" {
		t.Fatalf("expected status running, got %q", status)
	}
}

func TestHandler_CreateSandbox_TwinNotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return nil, fmt.Errorf("twin not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CreateSandbox, "POST", models.CreateSandboxRequest{
		TwinID: "twin-x",
		Name:   "test-sandbox",
	}, nil, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	if msg := decodeErrorEnvelope(t, w, "NOT_FOUND"); !strings.Contains(msg, "digital twin not found") {
		t.Fatalf("unexpected error message %q", msg)
	}
}

func TestHandler_ListSandboxes_OnlyOwnTenant(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	newSandbox(t, svc, "tenant-1", "twin-1", "mine")
	newSandbox(t, svc, "other-tenant", "twin-9", "theirs")

	w := performRequest(h, h.ListSandboxes, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	items := asList(t, w)
	if len(items) != 1 {
		t.Fatalf("expected exactly one own-tenant sandbox, got %d items\nbody=%s", len(items), w.Body.String())
	}
	tenant, _ := items[0].(map[string]interface{})["tenant_id"].(string)
	if tenant != "tenant-1" {
		t.Fatalf("expected only tenant-1 sandboxes, leaked %q", tenant)
	}
}

func TestHandler_ListRecordingSessions_PassesTenant(t *testing.T) {
	var gotTenant string
	repo := &mockDigitalTwinRepo{
		recordsByTwinFn: func(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error) {
			gotTenant = tenantID
			return nil, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListRecordingSessions, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotTenant != "tenant-1" {
		t.Fatalf("handler must forward the authenticated tenant, forwarded %q", gotTenant)
	}
}

func TestHandler_StopSandbox_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	sb := newSandbox(t, svc, "tenant-1", "twin-1", "sb-1")

	w := performRequest(h, h.StopSandbox, "POST", nil, map[string]string{"id": sb.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["id"] != sb.ID {
		t.Fatalf("expected id %s, got %v", sb.ID, data["id"])
	}
	if stopped := data["stopped"].(bool); !stopped {
		t.Fatalf("expected stopped=true after stopping, body=%s", w.Body.String())
	}
	if sb.Status != "stopped" {
		t.Fatalf("sandbox status must be persisted, got %q", sb.Status)
	}
}

func TestHandler_StopSandbox_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.StopSandbox, "POST", nil, map[string]string{"id": "sb-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	if code := decodeErrorEnvelope(t, w, "NOT_FOUND"); !strings.Contains(code, "sandbox not found") {
		t.Fatalf("unexpected error message %q", code)
	}
}

func TestHandler_StopSandbox_OtherTenantIsNotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	sb := newSandbox(t, svc, "tenant-1", "twin-1", "sb-1")

	w := performRequestAs("other-tenant", h, h.StopSandbox, "POST", nil, map[string]string{"id": sb.ID}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for a foreign sandbox, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
	if sb.Status != "running" {
		t.Fatalf("foreign tenant must not mutate the sandbox, got %q", sb.Status)
	}
}

func TestHandler_DestroySandbox_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	sb := newSandbox(t, svc, "tenant-1", "twin-1", "sb-1")

	w := performRequest(h, h.DestroySandbox, "DELETE", nil, map[string]string{"id": sb.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if destroyed := data["destroyed"].(bool); !destroyed {
		t.Fatalf("expected destroyed=true, body=%s", w.Body.String())
	}
	if sb.Status != "destroyed" {
		t.Fatalf("sandbox status must be destroyed, got %q", sb.Status)
	}
	// A destroyed sandbox must be gone: a second call is a not-found.
	w2 := performRequest(h, h.DestroySandbox, "DELETE", nil, map[string]string{"id": sb.ID}, nil)
	if w2.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after destroy, got %d body=%s", w2.Code, w2.Body.String())
	}
}

func TestHandler_DestroySandbox_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.DestroySandbox, "DELETE", nil, map[string]string{"id": "sb-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_SandboxHealth_HealthyWhileRunning(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	sb := newSandbox(t, svc, "tenant-1", "twin-1", "sb-1")

	w := performRequest(h, h.SandboxHealth, "GET", nil, map[string]string{"id": sb.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if healthy := data["healthy"].(bool); !healthy {
		t.Fatalf("a running sandbox must be healthy, body=%s", w.Body.String())
	}
	if status := data["status"].(string); status != "running" {
		t.Fatalf("expected status running, got %q", status)
	}
}

func TestHandler_SandboxHealth_NotHealthyAfterStop(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	sb := newSandbox(t, svc, "tenant-1", "twin-1", "sb-1")
	if _, err := svc.StopSandbox(context.Background(), "tenant-1", sb.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	w := performRequest(h, h.SandboxHealth, "GET", nil, map[string]string{"id": sb.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if healthy := data["healthy"].(bool); healthy {
		t.Fatalf("a stopped sandbox must not be reported healthy, body=%s", w.Body.String())
	}
	if status := data["status"].(string); status != "stopped" {
		t.Fatalf("expected status stopped, got %q", status)
	}
}

func TestHandler_SandboxHealth_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.SandboxHealth, "GET", nil, map[string]string{"id": "sb-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

// ==================== Recording ====================

func TestHandler_StartRecording_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.StartRecording, "POST", gin.H{"name": "rec-1"}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_StopRecording_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	session := svc.StartRecording(context.Background(), "tenant-1", "twin-1", "rec-1")

	w := performRequest(h, h.StopRecording, "POST", nil, map[string]string{"recordingId": session.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["status"] != "completed" {
		t.Fatalf("expected status completed, body=%s", w.Body.String())
	}
	if session.Status != "completed" || session.CompletedAt == nil {
		t.Fatalf("session must be marked completed with a timestamp, got status=%q completedAt=%v", session.Status, session.CompletedAt)
	}
}

func TestHandler_StopRecording_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.StopRecording, "POST", nil, map[string]string{"recordingId": "rec-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_StopRecording_OtherTenantIsNotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	session := svc.StartRecording(context.Background(), "tenant-1", "twin-1", "rec-1")

	w := performRequestAs("other-tenant", h, h.StopRecording, "POST", nil, map[string]string{"recordingId": session.ID}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for a foreign recording, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
	if session.Status != "recording" {
		t.Fatalf("foreign tenant must not stop the recording, got %q", session.Status)
	}
}

func TestHandler_PauseRecording_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	session := svc.StartRecording(context.Background(), "tenant-1", "twin-1", "rec-1")

	w := performRequest(h, h.PauseRecording, "POST", nil, map[string]string{"recordingId": session.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["status"] != "paused" {
		t.Fatalf("expected status paused, body=%s", w.Body.String())
	}
	if session.CompletedAt != nil {
		t.Fatalf("pausing must not complete the session, completedAt=%v", session.CompletedAt)
	}
}

func TestHandler_PauseRecording_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.PauseRecording, "POST", nil, map[string]string{"recordingId": "rec-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_GetRecordingDetail_LiveSession(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	session := svc.StartRecording(context.Background(), "tenant-1", "twin-1", "rec-1")
	session.Records = []interface{}{map[string]interface{}{"path": "/a"}, map[string]interface{}{"path": "/b"}}

	w := performRequest(h, h.GetRecordingDetail, "GET", nil, map[string]string{"recordingId": session.ID}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["recordCount"] != float64(2) {
		t.Fatalf("expected recordCount 2, body=%s", w.Body.String())
	}
	if records, ok := data["records"].([]interface{}); !ok || len(records) != 2 {
		t.Fatalf("expected 2 records, body=%s", w.Body.String())
	}
}

func TestHandler_GetRecordingDetail_FallsBackToRepository(t *testing.T) {
	var gotTenant string
	repo := &mockDigitalTwinRepo{
		recordingRecordsFn: func(ctx context.Context, tenantID, id string) ([]interface{}, error) {
			gotTenant = tenantID
			return []interface{}{"r1", "r2", "r3"}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingDetail, "GET", nil, map[string]string{"recordingId": "rec-persisted"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["recordCount"] != float64(3) {
		t.Fatalf("expected recordCount 3, body=%s", w.Body.String())
	}
	if gotTenant != "tenant-1" {
		t.Fatalf("repository fallback must be tenant scoped, forwarded %q", gotTenant)
	}
}

func TestHandler_GetRecordingDetail_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		recordingRecordsFn: func(ctx context.Context, tenantID, id string) ([]interface{}, error) {
			return nil, fmt.Errorf("recording session not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingDetail, "GET", nil, map[string]string{"recordingId": "rec-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_GetRecordingDetail_RepoError(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		recordingRecordsFn: func(ctx context.Context, tenantID, id string) ([]interface{}, error) {
			return nil, errors.New("db down")
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingDetail, "GET", nil, map[string]string{"recordingId": "rec-x"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "INTERNAL_ERROR")
}

func TestHandler_GetRecordingRecords_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		recordingRecordsFn: func(ctx context.Context, tenantID, id string) ([]interface{}, error) {
			if tenantID != "tenant-1" {
				return nil, fmt.Errorf("recording session not found: %w", dt_service.ErrNotFound)
			}
			return []interface{}{"r1"}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingRecords, "GET", nil, map[string]string{"recordingId": "rec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if records := asList(t, w); len(records) != 1 {
		t.Fatalf("expected one record, body=%s", w.Body.String())
	}
}

func TestHandler_GetRecordingRecords_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		recordingRecordsFn: func(ctx context.Context, tenantID, id string) ([]interface{}, error) {
			return nil, fmt.Errorf("recording session not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingRecords, "GET", nil, map[string]string{"recordingId": "rec-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

// ==================== Replay ====================

func TestHandler_StartReplay_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.StartReplay, "POST", models.CreateReplayStartRequest{
		RecordingSessionId: "rec-1",
		SandboxEndpoint:    "http://sandbox",
	}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_GetReplayStatus_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayStatus, "GET", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetReplayStatus_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		replayByIdFn: func(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
			return nil, fmt.Errorf("replay not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayStatus, "GET", nil, map[string]string{"replayId": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_GetReplayStatus_PassesTenant(t *testing.T) {
	var gotTenant string
	repo := &mockDigitalTwinRepo{
		replayByIdFn: func(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
			gotTenant = tenantID
			return &models.ReplaySession{ID: id, Status: "running"}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayStatus, "GET", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotTenant != "tenant-1" {
		t.Fatalf("handler must forward the authenticated tenant, forwarded %q", gotTenant)
	}
}

func TestHandler_CancelReplay_Success(t *testing.T) {
	var gotTenant, gotStatus string
	repo := &mockDigitalTwinRepo{
		updateReplayFn: func(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
			gotTenant, gotStatus = tenantID, status
			return &models.ReplaySession{ID: id, Status: status}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CancelReplay, "POST", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotTenant != "tenant-1" {
		t.Fatalf("cancel must be tenant scoped, forwarded %q", gotTenant)
	}
	if gotStatus != "cancelled" {
		t.Fatalf("cancel must set status cancelled, got %q", gotStatus)
	}
	data := asObject(t, w)
	if data["status"] != "cancelled" {
		t.Fatalf("expected status cancelled, body=%s", w.Body.String())
	}
}

func TestHandler_CancelReplay_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		updateReplayFn: func(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
			return nil, fmt.Errorf("replay session not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CancelReplay, "POST", nil, map[string]string{"replayId": "replay-missing"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_GetReplayReport_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		replayByIdFn: func(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
			return &models.ReplaySession{
				ID: id, Status: "completed",
				TotalRequests: 100, MatchedRequests: 80,
				CompletedRequests: 100,
			}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayReport, "GET", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	data := asObject(t, w)
	if data["replayId"] != "replay-1" {
		t.Fatalf("expected replayId replay-1, body=%s", w.Body.String())
	}
	summary, ok := data["summary"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected a summary object, body=%s", w.Body.String())
	}
	if summary["matchRate"] != "80.0%" {
		t.Fatalf("expected matchRate 80.0%%, got %v", summary["matchRate"])
	}
	if summary["totalRequests"] != float64(100) {
		t.Fatalf("expected totalRequests 100, got %v", summary["totalRequests"])
	}
}

func TestHandler_GetReplayReport_NotFound(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		replayByIdFn: func(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
			return nil, fmt.Errorf("replay not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayReport, "GET", nil, map[string]string{"replayId": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", w.Code, w.Body.String())
	}
	decodeErrorEnvelope(t, w, "NOT_FOUND")
}

func TestHandler_ListReplaySessions_PassesTenant(t *testing.T) {
	var gotTenant string
	repo := &mockDigitalTwinRepo{
		replaysByTwinFn: func(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error) {
			gotTenant = tenantID
			return nil, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListReplaySessions, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotTenant != "tenant-1" {
		t.Fatalf("handler must forward the authenticated tenant, forwarded %q", gotTenant)
	}
}

// ==================== Error injection ====================

func TestHandler_CreateTwin_ErrorInjection(t *testing.T) {
	repo := &mockDigitalTwinRepo{dbErr: errors.New("db down")}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CreateTwin, "POST", models.CreateDigitalTwinRequest{
		Name:          "x",
		ServiceType:   "api",
		SourceService: "s",
	}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_ListReplaySessions_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListReplaySessions, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListRecordingSessions_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListRecordingSessions, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
