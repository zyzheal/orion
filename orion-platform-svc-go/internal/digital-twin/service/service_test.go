package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"
)

// mockDigitalTwinRepo is an in-memory mock implementing DigitalTwinRepo.
//
// Every read method is tenant-aware: it rejects (returns empty / not found) for
// rows owned by a different tenant. This mirrors the real repository's JOIN on
// digital_twins.tenant_id so a service that stops forwarding the tenant id
// fails these tests instead of silently passing.
type mockDigitalTwinRepo struct {
	dbErr     error
	twins     map[string]*models.DigitalTwin
	snapshots map[string]*models.Snapshot
	records   map[string][]models.TrafficRecord // keyed by twinID
	// recordTenant maps twinID -> owning tenantID.
	recordTenant map[string]string
	replays      map[string]*models.ReplaySession
	// replayTenant maps replay session id -> owning tenantID.
	replayTenant map[string]string
	// recordingRecords maps session id -> persisted records (tenant-scoped by recordingTenant).
	recordingRecords map[string][]interface{}
	recordingTenant  map[string]string
}

func newMockRepo() *mockDigitalTwinRepo {
	return &mockDigitalTwinRepo{
		twins:            make(map[string]*models.DigitalTwin),
		snapshots:        make(map[string]*models.Snapshot),
		records:          make(map[string][]models.TrafficRecord),
		recordTenant:     make(map[string]string),
		replays:          make(map[string]*models.ReplaySession),
		replayTenant:     make(map[string]string),
		recordingRecords: make(map[string][]interface{}),
		recordingTenant:  make(map[string]string),
	}
}

func (m *mockDigitalTwinRepo) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "twin-" + tenantID + "-" + req.Name
	now := time.Now().UTC()
	twin := &models.DigitalTwin{
		ID:            id,
		TenantID:      tenantID,
		Name:          req.Name,
		ServiceType:   req.ServiceType,
		SourceService: req.SourceService,
		Status:        "active",
		CreatedAt:     now,
		UpdatedAt:     now,
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
		if t.TenantID != tenantID {
			continue
		}
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

// seedRecords stores traffic records for a twin under the given tenant.
func (m *mockDigitalTwinRepo) seedRecords(tenantID, twinID string, recs ...models.TrafficRecord) {
	m.recordTenant[twinID] = tenantID
	m.records[twinID] = append(m.records[twinID], recs...)
}

func (m *mockDigitalTwinRepo) FindTrafficRecordsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	if m.recordTenant[twinID] != tenantID {
		return []models.TrafficRecord{}, nil
	}
	recs, ok := m.records[twinID]
	if !ok {
		return []models.TrafficRecord{}, nil
	}
	return recs, nil
}

func (m *mockDigitalTwinRepo) GetRecordingRecordsBySessionID(ctx context.Context, tenantID, id string) ([]interface{}, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	if m.recordingTenant[id] != tenantID {
		return nil, ErrNotFound
	}
	if recs, ok := m.recordingRecords[id]; ok {
		return recs, nil
	}
	return []interface{}{}, nil
}

// seedRecordingRecords stores persisted records for a session under a tenant.
func (m *mockDigitalTwinRepo) seedRecordingRecords(tenantID, id string, recs []interface{}) {
	m.recordingTenant[id] = tenantID
	m.recordingRecords[id] = recs
}

func (m *mockDigitalTwinRepo) CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "replay-" + in.TwinID
	session := &models.ReplaySession{
		ID:                 id,
		TwinID:             in.TwinID,
		RecordingSessionID: in.RecordingSessionID,
		SandboxEndpoint:    in.SandboxEndpoint,
		Status:             in.Status,
		StartedAt:          in.StartedAt,
		TotalRequests:      100,
	}
	m.replays[id] = session
	// CreateReplaySession carries no tenant, so the session is attributed to the
	// mock's default tenant. Tests that need another tenant use
	// CreateReplaySessionForTenant.
	m.replayTenant[id] = "t1"
	return session, nil
}

func (m *mockDigitalTwinRepo) CreateReplaySessionForTenant(ctx context.Context, tenantID string, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	id := "replay-" + in.TwinID
	session := &models.ReplaySession{
		ID:                 id,
		TwinID:             in.TwinID,
		RecordingSessionID: in.RecordingSessionID,
		SandboxEndpoint:    in.SandboxEndpoint,
		Status:             in.Status,
		StartedAt:          in.StartedAt,
		TotalRequests:      100,
	}
	m.replays[id] = session
	m.replayTenant[id] = tenantID
	return session, nil
}

func (m *mockDigitalTwinRepo) FindReplaySessionsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	result := make([]models.ReplaySession, 0)
	for _, s := range m.replays {
		if s.TwinID == twinID && m.replayTenant[s.ID] == tenantID {
			result = append(result, *s)
		}
	}
	return result, nil
}

func (m *mockDigitalTwinRepo) FindReplaySessionById(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	s, ok := m.replays[id]
	if !ok || m.replayTenant[id] != tenantID {
		return nil, ErrReplayNotFound
	}
	return s, nil
}

func (m *mockDigitalTwinRepo) UpdateReplaySession(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	s, ok := m.replays[id]
	if !ok || m.replayTenant[id] != tenantID {
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

// createRunningSandbox provisions a twin plus a running sandbox owned by tenant.
func createRunningSandbox(t *testing.T, m *mockDigitalTwinRepo, svc *Service, ctx context.Context, tenantID, name string) *models.Sandbox {
	t.Helper()
	_, err := m.CreateTwin(ctx, tenantID, models.CreateDigitalTwinRequest{Name: name, ServiceType: "api", SourceService: "s"})
	if err != nil {
		t.Fatalf("seed twin: %v", err)
	}
	twinID := "twin-" + tenantID + "-" + name
	sb, err := svc.CreateSandbox(ctx, tenantID, models.CreateSandboxRequest{TwinID: twinID, Name: name})
	if err != nil {
		t.Fatalf("create sandbox: %v", err)
	}
	return sb
}

func TestCreateSandbox_RecordsTenantAndID(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb := createRunningSandbox(t, m, svc, context.Background(), "t1", "sb-1")
	if sb.TenantID != "t1" {
		t.Errorf("expected tenant t1, got %q", sb.TenantID)
	}
	if sb.ID == "" {
		t.Error("expected a non-empty sandbox id")
	}
	if sb.Status != "running" {
		t.Errorf("expected running, got %s", sb.Status)
	}
}

func TestStopSandbox_Found(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb := createRunningSandbox(t, m, svc, context.Background(), "t1", "sb-1")

	out, err := svc.StopSandbox(context.Background(), "t1", sb.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Status != "stopped" {
		t.Errorf("expected stopped, got %s", out.Status)
	}
}

func TestStopSandbox_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb, err := svc.StopSandbox(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if sb != nil {
		t.Errorf("expected nil sandbox, got %+v", sb)
	}
}

func TestStopSandbox_OtherTenantSandboxIsNotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb := createRunningSandbox(t, m, svc, context.Background(), "t1", "sb-1")

	_, err := svc.StopSandbox(context.Background(), "t2", sb.ID)
	if err == nil {
		t.Fatalf("expected not-found error for foreign tenant, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if sb.Status != "running" {
		t.Errorf("foreign tenant must not alter the sandbox; status=%s", sb.Status)
	}
}

func TestDestroySandbox(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb := createRunningSandbox(t, m, svc, context.Background(), "t1", "sb-1")

	out, err := svc.DestroySandbox(context.Background(), "t1", sb.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Status != "destroyed" {
		t.Errorf("expected destroyed, got %s", out.Status)
	}
	if _, err := svc.SandboxHealth(context.Background(), "t1", sb.ID); err == nil {
		t.Error("expected destroyed sandbox to be gone, got nil error")
	}
}

func TestDestroySandbox_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	out, err := svc.DestroySandbox(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if out != nil {
		t.Fatal("expected nil sandbox")
	}
}

func TestSandboxHealth(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	sb := createRunningSandbox(t, m, svc, context.Background(), "t1", "sb-1")

	out, err := svc.SandboxHealth(context.Background(), "t1", sb.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Status != "running" {
		t.Errorf("expected running (healthy), got %s", out.Status)
	}
}

func TestSandboxHealth_NotRunningIsNotHealthy(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	sb := createRunningSandbox(t, m, svc, ctx, "t1", "sb-1")

	if _, err := svc.StopSandbox(ctx, "t1", sb.ID); err != nil {
		t.Fatalf("stop: %v", err)
	}
	out, err := svc.SandboxHealth(ctx, "t1", sb.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Status != "stopped" {
		t.Errorf("expected stopped, got %s", out.Status)
	}
}

func TestSandboxHealth_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	out, err := svc.SandboxHealth(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if out != nil {
		t.Fatal("expected nil sandbox")
	}
}

func TestListSandboxes_ScopedToTenant(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	sb1 := createRunningSandbox(t, m, svc, ctx, "t1", "a")
	createRunningSandbox(t, m, svc, ctx, "t2", "b")

	got := svc.ListSandboxes(ctx, "t1")
	if len(got) != 1 {
		t.Fatalf("expected 1 sandbox for t1, got %d", len(got))
	}
	if got[0].TenantID != "t1" || got[0].ID != sb1.ID {
		t.Errorf("unexpected sandbox: %+v", got[0])
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
	sessions, err := svc.ListReplaySessions(ctx, "t1", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
}

func TestListReplaySessions_ForwardsTenant(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	_, _ = m.CreateReplaySessionForTenant(ctx, "t2", models.CreateReplaySessionInput{TwinID: "twin-2", Status: "running", StartedAt: time.Now().UTC()})
	if _, err := svc.ListReplaySessions(ctx, "t2", "twin-2"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The mock rejects rows owned by another tenant, so this only passes when
	// the service forwards the caller's tenant id.
	sessions, err := svc.ListReplaySessions(ctx, "t1", "twin-2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 0 {
		t.Fatalf("expected no sessions for a foreign tenant, got %d", len(sessions))
	}
}

func TestGetReplayStatus_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	// Pre-populate
	s, _ := m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "running", StartedAt: time.Now().UTC()})
	status, err := svc.GetReplayStatus(ctx, "t1", s.ID)
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

	status, err := svc.GetReplayStatus(ctx, "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected error")
	}
	if status != nil {
		t.Fatal("expected nil status")
	}
}

func TestGetReplayStatus_OtherTenantSessionIsNotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySessionForTenant(ctx, "t2", models.CreateReplaySessionInput{TwinID: "twin-9", Status: "running", StartedAt: time.Now().UTC()})
	status, err := svc.GetReplayStatus(ctx, "t1", s.ID)
	if err == nil {
		t.Fatalf("expected not-found error for a foreign tenant's session, got nil")
	}
	if status != nil {
		t.Fatalf("expected nil status, got %+v", status)
	}
}

func TestCancelReplay_Success(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySession(ctx, models.CreateReplaySessionInput{TwinID: "twin-1", Status: "running", StartedAt: time.Now().UTC()})
	summary, err := svc.CancelReplay(ctx, "t1", s.ID)
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

	summary, err := svc.CancelReplay(ctx, "t1", "nonexistent")
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
	report, err := svc.GetReplayReport(ctx, "t1", s.ID)
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

func TestGetReplayReport_OtherTenantReportIsNotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySessionForTenant(ctx, "t2", models.CreateReplaySessionInput{TwinID: "twin-8", Status: "completed", StartedAt: time.Now().UTC()})
	report, err := svc.GetReplayReport(ctx, "t1", s.ID)
	if err == nil {
		t.Fatalf("expected not-found error for a foreign tenant's report, got nil")
	}
	if report != nil {
		t.Fatalf("expected nil report, got %+v", report)
	}
}

func TestCancelReplay_OtherTenantSessionCannotBeCancelled(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()

	s, _ := m.CreateReplaySessionForTenant(ctx, "t2", models.CreateReplaySessionInput{TwinID: "twin-7", Status: "running", StartedAt: time.Now().UTC()})
	summary, err := svc.CancelReplay(ctx, "t1", s.ID)
	if err == nil {
		t.Fatalf("expected not-found error, got nil")
	}
	if summary != nil {
		t.Fatalf("expected nil summary, got %+v", summary)
	}
	if s.Status != "running" {
		t.Errorf("foreign tenant must not change the session status; got %s", s.Status)
	}
}

func TestStartRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	session := svc.StartRecording(context.Background(), "t1", "twin-1", "rec-1")
	if session.Status != "recording" {
		t.Errorf("expected recording, got %s", session.Status)
	}
	if session.TenantID != "t1" {
		t.Errorf("expected tenant t1, got %q", session.TenantID)
	}
	if len(session.Records) != 0 {
		t.Errorf("expected empty records, got %v", session.Records)
	}
}

func TestStopRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	session := svc.StartRecording(ctx, "t1", "twin-1", "rec-1")
	session.Records = []any{map[string]any{"method": "GET"}, map[string]any{"method": "POST"}}

	result, err := svc.StopRecording(ctx, "t1", session.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "completed" {
		t.Errorf("expected completed, got %s", result.Status)
	}
	if session.CompletedAt == nil {
		t.Error("expected completed_at to be set")
	}
	if session.RecordCount != 2 {
		t.Errorf("expected record_count 2, got %d", session.RecordCount)
	}
}

func TestStopRecording_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	result, err := svc.StopRecording(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if result != nil {
		t.Fatal("expected nil result")
	}
}

func TestStopRecording_OtherTenantRecordingCannotBeStopped(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	session := svc.StartRecording(ctx, "t2", "twin-1", "rec-1")

	result, err := svc.StopRecording(ctx, "t1", session.ID)
	if err == nil {
		t.Fatalf("expected not-found error, got nil")
	}
	if result != nil {
		t.Fatalf("expected nil result, got %+v", result)
	}
	if session.Status != "recording" {
		t.Errorf("foreign tenant must not change the session; got %s", session.Status)
	}
}

func TestPauseRecording(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	session := svc.StartRecording(ctx, "t1", "twin-1", "rec-1")

	result, err := svc.PauseRecording(ctx, "t1", session.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "paused" {
		t.Errorf("expected paused, got %s", result.Status)
	}
	if session.CompletedAt != nil {
		t.Error("pausing must not mark the session completed")
	}
}

func TestPauseRecording_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	result, err := svc.PauseRecording(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if result != nil {
		t.Fatal("expected nil result")
	}
}

func TestGetRecordingDetail_FromMemory(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	session := svc.StartRecording(ctx, "t1", "twin-1", "rec-1")
	session.Records = []any{"payload"}

	detail, err := svc.GetRecordingDetail(ctx, "t1", session.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detail.RecordCount != 1 {
		t.Errorf("expected 1 record, got %d", detail.RecordCount)
	}
	if len(detail.Records) != 1 {
		t.Errorf("expected 1 record item, got %d", len(detail.Records))
	}
}

func TestGetRecordingDetail_FallsBackToRepository(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	persisted := []interface{}{"p1", "p2"}
	m.seedRecordingRecords("t1", "rec-persisted", persisted)

	detail, err := svc.GetRecordingDetail(ctx, "t1", "rec-persisted")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detail.RecordCount != 2 {
		t.Errorf("expected 2 records, got %d", detail.RecordCount)
	}
}

func TestGetRecordingDetail_OtherTenantIsNotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	m.seedRecordingRecords("t2", "rec-foreign", []interface{}{"x"})

	detail, err := svc.GetRecordingDetail(ctx, "t1", "rec-foreign")
	if err == nil {
		t.Fatalf("expected not-found error for a foreign tenant, got nil")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected sentinel not-found, got %v", err)
	}
	if detail != nil {
		t.Fatalf("expected nil detail, got %+v", detail)
	}
}

func TestGetRecordingDetail_RepositoryErrorIsPropagated(t *testing.T) {
	m := newMockRepo()
	m.dbErr = errors.New("db down")
	svc := NewService(m)

	detail, err := svc.GetRecordingDetail(context.Background(), "t1", "rec-1")
	if err == nil {
		t.Fatal("expected repository error to be propagated, got nil")
	}
	if detail != nil {
		t.Fatalf("expected nil detail, got %+v", detail)
	}
}

func TestGetRecordingRecords(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	session := svc.StartRecording(ctx, "t1", "twin-1", "rec-1")
	session.Records = []any{"a"}

	records, err := svc.GetRecordingRecords(ctx, "t1", session.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Errorf("expected 1 record, got %d", len(records))
	}
}

func TestGetRecordingRecords_NotFound(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	records, err := svc.GetRecordingRecords(context.Background(), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
	if records != nil {
		t.Fatalf("expected nil records, got %v", records)
	}
}

func TestListRecordingSessions_ForwardsTenant(t *testing.T) {
	m := newMockRepo()
	svc := NewService(m)
	ctx := context.Background()
	now := time.Now().UTC()
	m.seedRecords("t1", "twin-1", models.TrafficRecord{
		ID: "tr-1", TwinID: "twin-1", Type: "record", RequestCount: 7, StartedAt: now,
	})

	sessions, err := svc.ListRecordingSessions(ctx, "t1", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].RecordCount != 7 {
		t.Errorf("expected 7 records, got %d", sessions[0].RecordCount)
	}

	// The mock only returns the row for t1, so a foreign tenant must see none.
	empty, err := svc.ListRecordingSessions(ctx, "t2", "twin-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("expected no sessions for a foreign tenant, got %d", len(empty))
	}
}
