package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"
)

// mockDigitalTwinRepo is an in-memory mock implementing DigitalTwinRepo.
type mockDigitalTwinRepo struct {
	dbErr    error
	twins    map[string]*models.DigitalTwin
	snapshots map[string]*models.Snapshot
	records  map[string][]models.TrafficRecord // keyed by twinID
	replays  map[string]*models.ReplaySession
}

func newMockRepo() *mockDigitalTwinRepo {
	return &mockDigitalTwinRepo{
		twins:     make(map[string]*models.DigitalTwin),
		snapshots: make(map[string]*models.Snapshot),
		records:   make(map[string][]models.TrafficRecord),
		replays:   make(map[string]*models.ReplaySession),
	}
}

func (m *mockDigitalTwinRepo) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "twin-" + tenantID + "-" + req.Name
	now := time.Now().UTC()
	twin := &models.DigitalTwin{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		ServiceType: req.ServiceType,
		SourceService: req.SourceService,
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.twins[tenantID+":"+id] = twin
	return twin, nil
}

func (m *mockDigitalTwinRepo) FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	t, ok := m.twins[tenantID+":"+id]
	if !ok {
		return nil, ErrTwinNotFound
	}
	return t, nil
}

func (m *mockDigitalTwinRepo) FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	result := make([]models.DigitalTwin, 0)
	for _, t := range m.twins {
		result = append(result, *t)
	}
	return result, nil
}

func (m *mockDigitalTwinRepo) CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "snap-" + twinID + "-" + name
	snap := &models.Snapshot{
		ID:        id,
		TwinID:    twinID,
		Name:      name,
		CreatedAt: time.Now().UTC(),
	}
	m.snapshots[id] = snap
	return snap, nil
}

func (m *mockDigitalTwinRepo) CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "rec-" + in.TwinID + "-" + in.Type
	record := &models.TrafficRecord{
		ID:           id,
		TwinID:       in.TwinID,
		Type:         in.Type,
		RequestCount: in.RequestCount,
		Duration:     in.Duration,
		StartedAt:    in.StartedAt,
		CompletedAt:  in.CompletedAt,
	}
	m.records[in.TwinID] = append(m.records[in.TwinID], *record)
	return record, nil
}

func (m *mockDigitalTwinRepo) FindTrafficRecordsByTwinID(ctx context.Context, twinID string) ([]models.TrafficRecord, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return m.records[twinID], nil
}

func (m *mockDigitalTwinRepo) CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "replay-" + in.TwinID
	session := &models.ReplaySession{
		ID:               id,
		TwinID:           in.TwinID,
		RecordingSessionID: in.RecordingSessionID,
		SandboxEndpoint:  in.SandboxEndpoint,
		Status:           in.Status,
		StartedAt:        in.StartedAt,
		TotalRequests:    100,
	}
	m.replays[id] = session
	return session, nil
}

func (m *mockDigitalTwinRepo) FindReplaySessionsByTwinID(ctx context.Context, twinID string) ([]models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	var result []models.ReplaySession
	for _, s := range m.replays {
		if s.TwinID == twinID {
			result = append(result, *s)
		}
	}
	return result, nil
}

func (m *mockDigitalTwinRepo) FindReplaySessionById(ctx context.Context, id string) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	s, ok := m.replays[id]
	if !ok {
		return nil, ErrReplayNotFound
	}
	return s, nil
}

func (m *mockDigitalTwinRepo) UpdateReplaySession(ctx context.Context, id, status string) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	s, ok := m.replays[id]
	if !ok {
		return nil, ErrReplayNotFound
	}
	s.Status = status
	return s, nil
}

// --- Tests ---

func TestCreateTwin_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	req := models.CreateDigitalTwinRequest{
		Name:          "test-twin",
		ServiceType:   "api",
		SourceService: "my-service",
	}
	twin, err := svc.CreateTwin(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if twin.Name != "test-twin" {
		t.Errorf("expected name test-twin, got %s", twin.Name)
	}
}

func TestCreateTwin_ErrorInjection(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db failure")
	svc := NewService(m)
	ctx := context.Background()

	req := models.CreateDigitalTwinRequest{
		Name:          "test-twin",
		ServiceType:   "api",
		SourceService: "my-service",
	}
	twin, err := svc.CreateTwin(ctx, "t1", req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if twin != nil {
		t.Fatal("expected nil twin on error")
	}
}

func TestFindTwin_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Create a twin first
	_, _ = m.CreateTwin(ctx, "t1", models.CreateDigitalTwinRequest{Name: "t1", ServiceType: "api", SourceService: "s"})
	twin, err := svc.FindTwin(ctx, "t1", "twin-t1-t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if twin.Name != "t1" {
		t.Errorf("expected name t1, got %s", twin.Name)
	}
}

func TestFindTwin_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	twin, err := svc.FindTwin(ctx, "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error")
	}
	if twin != nil {
		t.Fatal("expected nil twin")
	}
}

func TestFindTwin_ErrorInjection(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db failure")
	svc := NewService(m)
	ctx := context.Background()

	twin, err := svc.FindTwin(ctx, "t1", "t1")
	if err == nil {
		t.Fatal("expected error")
	}
	if twin != nil {
		t.Fatal("expected nil twin")
	}
}

func TestListTwins_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Pre-populate
	_, _ = m.CreateTwin(ctx, "t1", models.CreateDigitalTwinRequest{Name: "a", ServiceType: "api", SourceService: "s"})
	_, _ = m.CreateTwin(ctx, "t1", models.CreateDigitalTwinRequest{Name: "b", ServiceType: "web", SourceService: "s"})
	twins, err := svc.ListTwins(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(twins) != 2 {
		t.Fatalf("expected 2 twins, got %d", len(twins))
	}
}

func TestListTwins_Empty(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	twins, err := svc.ListTwins(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if twins == nil {
		t.Fatal("expected empty slice, got nil")
	}
	if len(twins) != 0 {
		t.Fatalf("expected 0 twins, got %d", len(twins))
	}
}

func TestListTwins_ErrorInjection(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db failure")
	svc := NewService(m)
	ctx := context.Background()

	twins, err := svc.ListTwins(ctx, "t1")
	if err == nil {
		t.Fatal("expected error")
	}
	if twins != nil {
		t.Fatal("expected nil slice")
	}
}

func TestCreateSnapshot_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	snap, err := svc.CreateSnapshot(ctx, "twin-1", "snapshot-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if snap.Name != "snapshot-1" {
		t.Errorf("expected snapshot-1, got %s", snap.Name)
	}
}

func TestCreateSnapshot_ErrorInjection(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db failure")
	svc := NewService(m)
	ctx := context.Background()

	snap, err := svc.CreateSnapshot(ctx, "twin-1", "snap")
	if err == nil {
		t.Fatal("expected error")
	}
	if snap != nil {
		t.Fatal("expected nil snapshot")
	}
}

func TestCreateSandbox_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Ensure the twin exists
	_, _ = m.CreateTwin(ctx, "t1", models.CreateDigitalTwinRequest{Name: "t1", ServiceType: "api", SourceService: "s"})
	sb, err := svc.CreateSandbox(ctx, "t1", models.CreateSandboxRequest{TwinID: "twin-t1-t1", Name: "sb-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sb.Status != "running" {
		t.Errorf("expected running, got %s", sb.Status)
	}
	if sb.TwinID != "twin-t1-t1" {
		t.Errorf("expected twin-t1-t1, got %s", sb.TwinID)
	}
}

func TestCreateSandbox_TwinNotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	sb, err := svc.CreateSandbox(ctx, "t1", models.CreateSandboxRequest{TwinID: "nonexistent", Name: "sb"})
	if err == nil {
		t.Fatal("expected error for missing twin")
	}
	if sb != nil {
		t.Fatal("expected nil sandbox")
	}
}

func TestStopSandbox_Found(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb, err := svc.StopSandbox("sb-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sb.Status != "stopped" {
		t.Errorf("expected stopped, got %s", sb.Status)
	}
}

func TestStopSandbox_NotFoundReturnsStub(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb, err := svc.StopSandbox("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sb.Status != "stopped" {
		t.Errorf("expected stopped stub, got %s", sb.Status)
	}
}

func TestDestroySandbox(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb, err := svc.DestroySandbox("sb-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sb.Status != "destroyed" {
		t.Errorf("expected destroyed, got %s", sb.Status)
	}
}

func TestSandboxHealth(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb, err := svc.SandboxHealth("sb-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sb.Status != "healthy" {
		t.Errorf("expected healthy, got %s", sb.Status)
	}
}

func TestGetTwinState_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Ensure twin exists
	_, _ = m.CreateTwin(ctx, "t1", models.CreateDigitalTwinRequest{Name: "t1", ServiceType: "api", SourceService: "s"})
	state, err := svc.GetTwinState(ctx, "t1", "twin-t1-t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if state.TwinID != "twin-t1-t1" {
		t.Errorf("expected twin-t1-t1, got %s", state.TwinID)
	}
	if state.Status == "" {
		t.Error("expected non-empty status")
	}
}

func TestGetTwinState_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	state, err := svc.GetTwinState(ctx, "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing twin")
	}
	if state != nil {
		t.Fatal("expected nil state")
	}
}

func TestRecordTraffic_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	record, err := svc.RecordTraffic(ctx, "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.Type != "record" {
		t.Errorf("expected record, got %s", record.Type)
	}
}

func TestReplayTraffic_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	result, err := svc.ReplayTraffic(ctx, "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "completed" {
		t.Errorf("expected completed, got %s", result.Status)
	}
}

func TestReplayTraffic_ErrorInjection(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db failure")
	svc := NewService(m)
	ctx := context.Background()

	result, err := svc.ReplayTraffic(ctx, "twin-1")
	if err == nil {
		t.Fatal("expected error")
	}
	if result != nil {
		t.Fatal("expected nil result")
	}
}

func TestStartReplay_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	req := models.CreateReplayStartRequest{
		RecordingSessionId: "rec-1",
		SandboxEndpoint:    "http://sandbox",
	}
	session, err := svc.StartReplay(ctx, "twin-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session.Status != "running" {
		t.Errorf("expected running, got %s", session.Status)
	}
}

func TestListReplaySessions_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Pre-populate
	_, _ = m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "running", StartedAt: time.Now().UTC()})
	sessions, err := svc.ListReplaySessions(ctx, "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
}

func TestGetReplayStatus_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Pre-populate
	s, _ := m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "running", StartedAt: time.Now().UTC()})
	status, err := svc.GetReplayStatus(ctx, s.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Status != "running" {
		t.Errorf("expected running, got %s", status.Status)
	}
}

func TestGetReplayStatus_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	status, err := svc.GetReplayStatus(ctx, "nonexistent")
	if err == nil {
		t.Fatal("expected error")
	}
	if status != nil {
		t.Fatal("expected nil status")
	}
}

func TestCancelReplay_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "running", StartedAt: time.Now().UTC()})
	summary, err := svc.CancelReplay(ctx, s.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.Status != "cancelled" {
		t.Errorf("expected cancelled, got %s", summary.Status)
	}
}

func TestCancelReplay_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	summary, err := svc.CancelReplay(ctx, "nonexistent")
	if err == nil {
		t.Fatal("expected error")
	}
	if summary != nil {
		t.Fatal("expected nil summary")
	}
}

func TestGetReplayReport_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "completed", StartedAt: time.Now().UTC()})
	s.TotalRequests = 100
	s.MatchedRequests = 80
	report, err := svc.GetReplayReport(ctx, s.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.Status != "completed" {
		t.Errorf("expected completed, got %s", report.Status)
	}
	if report.Summary.TotalRequests != 100 {
		t.Errorf("expected 100 total, got %d", report.Summary.TotalRequests)
	}
	if report.Summary.MatchRate != "80.0%" {
		t.Errorf("expected 80.0%%, got %s", report.Summary.MatchRate)
	}
}

func TestStartRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	session := svc.StartRecording("twin-1", "rec-1")
	if session.Status != "recording" {
		t.Errorf("expected recording, got %s", session.Status)
	}
}

func TestStopRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	result := svc.StopRecording("rec-1")
	if result.Status != "completed" {
		t.Errorf("expected completed, got %s", result.Status)
	}
}

func TestPauseRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	result := svc.PauseRecording("rec-1")
	if result.Status != "paused" {
		t.Errorf("expected paused, got %s", result.Status)
	}
}
