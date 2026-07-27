package handler

import (
	"bytes"
	"fmt"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"
	dt_service "orion/platform-svc-go/internal/digital-twin/service"

	"github.com/gin-gonic/gin"
)

// --- mockDigitalTwinRepo implements dt_service.DigitalTwinRepo ---

type mockDigitalTwinRepo struct {
	dbErr           error
	twinFn          func(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error)
	findTwinFn      func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	findAllTwinsFn  func(ctx context.Context, tenantID string) ([]models.DigitalTwin, error)
	createSnapshotFn func(ctx context.Context, twinID, name string) (*models.Snapshot, error)
	createRecordFn  func(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error)
	recordsByTwinFn func(ctx context.Context, twinID string) ([]models.TrafficRecord, error)
	replayFn        func(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error)
	replaysByTwinFn func(ctx context.Context, twinID string) ([]models.ReplaySession, error)
	replayByIdFn    func(ctx context.Context, id string) (*models.ReplaySession, error)
	updateReplayFn  func(ctx context.Context, id, status string) (*models.ReplaySession, error)
}

func (m *mockDigitalTwinRepo) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	if m.twinFn != nil { return m.twinFn(ctx, tenantID, req) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.DigitalTwin{ID: "twin-" + req.Name, TenantID: tenantID, Name: req.Name, ServiceType: req.ServiceType, Status: "active", CreatedAt: time.Now().UTC()}, nil
}
func (m *mockDigitalTwinRepo) FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.findTwinFn != nil { return m.findTwinFn(ctx, tenantID, id) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.DigitalTwin{ID: id, TenantID: tenantID, Name: "twin"}, nil
}
func (m *mockDigitalTwinRepo) FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error) {
	if m.findAllTwinsFn != nil { return m.findAllTwinsFn(ctx, tenantID) }
	if m.dbErr != nil { return nil, m.dbErr }
	return []models.DigitalTwin{{ID: "t1", Name: "a"}, {ID: "t2", Name: "b"}}, nil
}
func (m *mockDigitalTwinRepo) CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error) {
	if m.createSnapshotFn != nil { return m.createSnapshotFn(ctx, twinID, name) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.Snapshot{ID: "snap-" + name, TwinID: twinID, Name: name, CreatedAt: time.Now().UTC()}, nil
}
func (m *mockDigitalTwinRepo) CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error) {
	if m.createRecordFn != nil { return m.createRecordFn(ctx, in) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.TrafficRecord{ID: "rec-" + in.TwinID, TwinID: in.TwinID, Type: in.Type, StartedAt: in.StartedAt}, nil
}
func (m *mockDigitalTwinRepo) FindTrafficRecordsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error) {
	if m.recordsByTwinFn != nil { return m.recordsByTwinFn(ctx, twinID) }
	if m.dbErr != nil { return nil, m.dbErr }
	return nil, nil
}
func (m *mockDigitalTwinRepo) CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	if m.replayFn != nil { return m.replayFn(ctx, in) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.ReplaySession{ID: "replay-" + in.TwinID, Status: in.Status, StartedAt: in.StartedAt}, nil
}
func (m *mockDigitalTwinRepo) FindReplaySessionsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error) {
	if m.replaysByTwinFn != nil { return m.replaysByTwinFn(ctx, twinID) }
	if m.dbErr != nil { return nil, m.dbErr }
	return nil, nil
}
func (m *mockDigitalTwinRepo) FindReplaySessionById(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
	if m.replayByIdFn != nil { return m.replayByIdFn(ctx, id) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.ReplaySession{ID: id, Status: "running"}, nil
}
func (m *mockDigitalTwinRepo) UpdateReplaySession(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
	if m.updateReplayFn != nil { return m.updateReplayFn(ctx, id, status) }
	if m.dbErr != nil { return nil, m.dbErr }
	return &models.ReplaySession{ID: id, Status: status}, nil
}

// --- helpers ---

func newHandlerWithSvc(svc *dt_service.Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
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
	repo := &mockDigitalTwinRepo{
		findTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id, Name: "twin-1"}, nil
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CreateSandbox, "POST", models.CreateSandboxRequest{
		TwinID: "twin-1",
		Name:   "test-sandbox",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_ListSandboxes_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListSandboxes, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_StopSandbox_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.StopSandbox, "POST", nil, map[string]string{"id": "sb-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DestroySandbox_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.DestroySandbox, "DELETE", nil, map[string]string{"id": "sb-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_SandboxHealth_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.SandboxHealth, "GET", nil, map[string]string{"id": "sb-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
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
	w := performRequest(h, h.StopRecording, "POST", nil, map[string]string{"recordingId": "rec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_PauseRecording_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.PauseRecording, "POST", nil, map[string]string{"recordingId": "rec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetRecordingDetail_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingDetail, "GET", nil, map[string]string{"recordingId": "rec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetRecordingRecords_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRecordingRecords, "GET", nil, map[string]string{"recordingId": "rec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
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
		replayByIdFn: func(ctx context.Context, id string) (*models.ReplaySession, error) {
			return nil, fmt.Errorf("replay not found: %w", dt_service.ErrNotFound)
		},
	}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayStatus, "GET", nil, map[string]string{"replayId": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_CancelReplay_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CancelReplay, "POST", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetReplayReport_Success(t *testing.T) {
	repo := &mockDigitalTwinRepo{}
	svc := dt_service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReplayReport, "GET", nil, map[string]string{"replayId": "replay-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
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
