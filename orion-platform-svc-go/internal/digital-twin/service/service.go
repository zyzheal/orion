package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error)
	CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error)
	CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error)
	CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error)
	FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error)
	FindReplaySessionById(ctx context.Context, id string) (*models.ReplaySession, error)
	FindReplaySessionsByTwinID(ctx context.Context, twinID string) ([]models.ReplaySession, error)
	FindTrafficRecordsByTwinID(ctx context.Context, twinID string) ([]models.TrafficRecord, error)
	FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	UpdateReplaySession(ctx context.Context, id, status string) (*models.ReplaySession, error)
}

type SimulationState struct {
	TwinID           string    `json:"twin_id"`
	Status           string    `json:"status"`
	LastTransition   time.Time `json:"last_transition"`
	latency          int64
	errorRate        float64
	state            string
	lastTransitionAt time.Time
	cpuUsage         int64
	memoryUsage      int64
	Replicas         int       `json:"replicas"`
	CPUUsage         int64     `json:"cpu_usage"`
	MemoryUsage      int64     `json:"memory_usage"`
	NetworkIO        NetworkIO `json:"network_io"`
	LastSync         time.Time `json:"last_sync"`
}

type Service struct {
	repo            RepositoryInterface
	sandboxStore    map[string]*models.Sandbox
	recordingStore  map[string]*models.RecordingSession
	simulationStore map[string]SimulationState
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:            repo,
		sandboxStore:    make(map[string]*models.Sandbox),
		recordingStore:  make(map[string]*models.RecordingSession),
		simulationStore: make(map[string]SimulationState),
	}
}

// --- Digital Twin CRUD ---

func (s *Service) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	return s.repo.CreateTwin(ctx, tenantID, req)
}

func (s *Service) ListTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error) {
	return s.repo.FindAllTwins(ctx, tenantID)
}

func (s *Service) FindTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	return s.repo.FindTwinByID(ctx, tenantID, id)
}

// --- Twin state (simulation) ---

// GetTwinState returns the simulated runtime state for a twin.
func (s *Service) GetTwinState(ctx context.Context, tenantID, twinID string) (*TwinState, error) {
	_, err := s.repo.FindTwinByID(ctx, tenantID, twinID)
	if err != nil {
		return nil, err
	}
	simulated := s.tick(twinID)
	cpuUsage := simulated.latency / (simulated.latency + 800) * 100
	memUsage := simulated.errorRate * 100
	inbound := int(float64(simulated.latency)*0.8) + rand.Intn(20)
	outbound := int(float64(simulated.latency)*0.4) + rand.Intn(10)
	return &TwinState{
		TwinID:      twinID,
		Status:      simulated.state,
		Replicas:    3,
		CPUUsage:    int(cpuUsage),
		MemoryUsage: int(memUsage),
		NetworkIO: NetworkIO{
			Inbound:  strconv.Itoa(inbound) + "MB/s",
			Outbound: strconv.Itoa(outbound) + "MB/s",
		},
		LastSync: simulated.lastTransitionAt,
	}, nil
}

// --- Snapshot ---

func (s *Service) CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error) {
	return s.repo.CreateSnapshot(ctx, twinID, name)
}

// --- Sandbox ---

// CreateSandbox validates twin exists and creates a sandbox (lifecycle managed in-memory).
func (s *Service) CreateSandbox(ctx context.Context, tenantID string, req models.CreateSandboxRequest) (*models.Sandbox, error) {
	_, err := s.repo.FindTwinByID(ctx, tenantID, req.TwinID)
	if err != nil {
		return nil, fmt.Errorf("twin not found: %w", err)
	}
	id := "sb-" + fmt.Sprintf("%d-%s", time.Now().UnixNano(), randString(4))
	sb := &models.Sandbox{
		TwinID:     req.TwinID,
		Name:       req.Name,
		SnapshotID: req.SnapshotID,
		Status:     "running",
	}
	s.sandboxStore[id] = sb
	return sb, nil
}

func (s *Service) ListSandboxes(ctx context.Context) []models.Sandbox {
	result := make([]models.Sandbox, 0)
	for _, sb := range s.sandboxStore {
		result = append(result, *sb)
	}
	return result
}

func (s *Service) StopSandbox(id string) (*models.Sandbox, error) {
	sb, ok := s.sandboxStore[id]
	if !ok {
		// Return a stub even if not in store (legacy map behavior).
		return &models.Sandbox{Status: "stopped"}, nil
	}
	sb.Status = "stopped"
	return sb, nil
}

func (s *Service) DestroySandbox(id string) (*models.Sandbox, error) {
	delete(s.sandboxStore, id)
	return &models.Sandbox{Status: "destroyed"}, nil
}

func (s *Service) SandboxHealth(id string) (*models.Sandbox, error) {
	return &models.Sandbox{Status: "healthy"}, nil
}

// --- Traffic Recording ---

// RecordTraffic creates a traffic record (legacy endpoint).
func (s *Service) RecordTraffic(ctx context.Context, twinID string) (*models.TrafficRecord, error) {
	return s.repo.CreateTrafficRecord(ctx, models.CreateTrafficRecordInput{
		TwinID:    twinID,
		Type:      "record",
		StartedAt: time.Now().UTC(),
	})
}

// StartRecording creates a recording session (managed by TrafficRecorderService).
func (s *Service) StartRecording(twinID, name string) *models.RecordingSession {
	id := "rec-" + fmt.Sprintf("%d-%s", time.Now().UnixNano(), randString(4))
	session := &models.RecordingSession{
		ID:        id,
		TwinID:    twinID,
		Name:      name,
		Status:    "recording",
		Records:   []any{},
		StartedAt: time.Now().UTC(),
	}
	s.recordingStore[id] = session
	return session
}

// ListRecordingSessions returns recording sessions for a twin.
func (s *Service) ListRecordingSessions(ctx context.Context, twinID string) ([]RecordingSessionSummary, error) {
	records, err := s.repo.FindTrafficRecordsByTwinID(ctx, twinID)
	if err != nil {
		return nil, err
	}
	sessions := make([]RecordingSessionSummary, 0)
	for _, r := range records {
		if r.Type != "record" {
			continue
		}
		s := RecordingSessionSummary{
			ID:          r.ID,
			Name:        "Recording " + r.ID,
			Status:      "completed",
			RecordCount: r.RequestCount,
			StartedAt:   r.StartedAt,
			CompletedAt: r.CompletedAt,
		}
		if r.CompletedAt == nil {
			s.Status = "recording"
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (s *Service) StopRecording(recordingID string) *RecordingResult {
	if session, ok := s.recordingStore[recordingID]; ok {
		session.Status = "completed"
	}
	return &RecordingResult{ID: recordingID, Status: "completed"}
}

func (s *Service) PauseRecording(recordingID string) *RecordingResult {
	if session, ok := s.recordingStore[recordingID]; ok {
		session.Status = "paused"
	}
	return &RecordingResult{ID: recordingID, Status: "paused"}
}

func (s *Service) GetRecordingDetail(recordingID string) *RecordingDetail {
	return &RecordingDetail{
		ID:          recordingID,
		RecordCount: 0,
		Records:     []any{},
	}
}

func (s *Service) GetRecordingRecords(recordingID string) []any {
	return []any{}
}

// --- Traffic Replay ---

// ReplayTraffic creates a replay record (legacy endpoint).
func (s *Service) ReplayTraffic(ctx context.Context, twinID string) (*ReplayTrafficResult, error) {
	count := rand.Intn(1000)
	duration := fmt.Sprintf("%ds", rand.Intn(60))
	record, err := s.repo.CreateTrafficRecord(ctx, models.CreateTrafficRecordInput{
		TwinID:       twinID,
		Type:         "replay",
		StartedAt:    time.Now().UTC(),
		CompletedAt:  ptrTime(time.Now().UTC()),
		RequestCount: count,
		Duration:     duration,
	})
	if err != nil {
		return nil, err
	}
	return &ReplayTrafficResult{
		ReplayID:         record.ID,
		Status:           "completed",
		RequestsReplayed: record.RequestCount,
	}, nil
}

// StartReplay creates a replay session (managed by repository).
func (s *Service) StartReplay(ctx context.Context, twinID string, req models.CreateReplayStartRequest) (*models.ReplaySession, error) {
	return s.repo.CreateReplaySession(ctx, models.CreateReplaySessionInput{
		TwinID:             twinID,
		RecordingSessionID: req.RecordingSessionId,
		SandboxEndpoint:    req.SandboxEndpoint,
		Status:             "running",
		StartedAt:          time.Now().UTC(),
	})
}

func (s *Service) ListReplaySessions(ctx context.Context, twinID string) ([]ReplaySessionSummary, error) {
	sessions, err := s.repo.FindReplaySessionsByTwinID(ctx, twinID)
	if err != nil {
		return nil, err
	}
	summaries := make([]ReplaySessionSummary, 0, len(sessions))
	for _, s := range sessions {
		summaries = append(summaries, ReplaySessionSummary{
			ID:                 s.ID,
			RecordingSessionID: s.RecordingSessionID,
			Status:             s.Status,
			Progress:           s.Progress,
			TotalRequests:      s.TotalRequests,
			StartedAt:          s.StartedAt,
			CompletedAt:        s.CompletedAt,
		})
	}
	return summaries, nil
}

func (s *Service) GetReplayStatus(ctx context.Context, replayID string) (*ReplayStatusDetail, error) {
	session, err := s.repo.FindReplaySessionById(ctx, replayID)
	if err != nil {
		return nil, err
	}
	return &ReplayStatusDetail{
		ID:                session.ID,
		Status:            session.Status,
		Progress:          session.Progress,
		TotalRequests:     session.TotalRequests,
		CompletedRequests: session.CompletedRequests,
		MatchedRequests:   session.MatchedRequests,
		FailedRequests:    session.FailedRequests,
		StartedAt:         session.StartedAt,
		CompletedAt:       session.CompletedAt,
	}, nil
}

func (s *Service) CancelReplay(ctx context.Context, replayID string) (*ReplaySessionSummary, error) {
	updated, err := s.repo.UpdateReplaySession(ctx, replayID, "cancelled")
	if err != nil {
		return nil, err
	}
	return &ReplaySessionSummary{
		ID:     updated.ID,
		Status: updated.Status,
	}, nil
}

func (s *Service) GetReplayReport(ctx context.Context, replayID string) (*ReplayReport, error) {
	session, err := s.repo.FindReplaySessionById(ctx, replayID)
	if err != nil {
		return nil, err
	}
	matchRate := "0%"
	if session.TotalRequests > 0 {
		matchRate = fmt.Sprintf("%.1f%%", float64(session.MatchedRequests)/float64(session.TotalRequests)*100)
	}
	return &ReplayReport{
		ReplayID: session.ID,
		Status:   session.Status,
		Summary: ReplaySummary{
			TotalRequests:     session.TotalRequests,
			CompletedRequests: session.CompletedRequests,
			MatchedRequests:   session.MatchedRequests,
			FailedRequests:    session.FailedRequests,
			MatchRate:         matchRate,
		},
		Results:     []any{},
		StartedAt:   session.StartedAt,
		CompletedAt: session.CompletedAt,
	}, nil
}

// --- Simulation Engine (mirrors TS StateSimulationEngine) ---

type SimEngineState struct {
	state            string
	latency          int
	errorRate        float64
	lastTransitionAt time.Time
}

type TwinState struct {
	TwinID      string    `json:"twinId"`
	Status      string    `json:"status"`
	Replicas    int       `json:"replicas"`
	CPUUsage    int       `json:"cpuUsage"`
	MemoryUsage int       `json:"memoryUsage"`
	NetworkIO   NetworkIO `json:"networkIO"`
	LastSync    time.Time `json:"lastSync"`
}

type NetworkIO struct {
	Inbound  string `json:"inbound"`
	Outbound string `json:"outbound"`
}

type RecordingSessionSummary struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Status      string     `json:"status"`
	RecordCount int        `json:"recordCount"`
	StartedAt   time.Time  `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

type RecordingResult struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type RecordingDetail struct {
	ID          string `json:"id"`
	RecordCount int    `json:"recordCount"`
	Records     []any  `json:"records"`
}

type ReplaySessionSummary struct {
	ID                 string     `json:"id"`
	RecordingSessionID string     `json:"recordingSessionId"`
	Status             string     `json:"status"`
	Progress           int        `json:"progress"`
	TotalRequests      int        `json:"totalRequests"`
	StartedAt          time.Time  `json:"startedAt"`
	CompletedAt        *time.Time `json:"completedAt,omitempty"`
}

type ReplayTrafficResult struct {
	ReplayID         string `json:"replayId"`
	Status           string `json:"status"`
	RequestsReplayed int    `json:"requestsReplayed"`
}

type ReplayStatusDetail struct {
	ID                string     `json:"id"`
	Status            string     `json:"status"`
	Progress          int        `json:"progress"`
	TotalRequests     int        `json:"totalRequests"`
	CompletedRequests int        `json:"completedRequests"`
	MatchedRequests   int        `json:"matchedRequests"`
	FailedRequests    int        `json:"failedRequests"`
	StartedAt         time.Time  `json:"startedAt"`
	CompletedAt       *time.Time `json:"completedAt,omitempty"`
}

type ReplayReport struct {
	ReplayID    string        `json:"replayId"`
	Status      string        `json:"status"`
	Summary     ReplaySummary `json:"summary"`
	Results     []any         `json:"results"`
	StartedAt   time.Time     `json:"startedAt"`
	CompletedAt *time.Time    `json:"completedAt,omitempty"`
}

type ReplaySummary struct {
	TotalRequests     int    `json:"totalRequests"`
	CompletedRequests int    `json:"completedRequests"`
	MatchedRequests   int    `json:"matchedRequests"`
	FailedRequests    int    `json:"failedRequests"`
	MatchRate         string `json:"matchRate"`
}

// tick simulates a state transition for a twin.
func (s *Service) tick(twinID string) SimulationState {
	if st, ok := s.simulationStore[twinID]; ok {
		return st
	}
	// Deterministic-ish simulation state per twin.
	latency := 200 + (hashInt(twinID) % 600)
	state := "healthy"
	errorRate := float64(hashInt(twinID)%10) / 100.0
	if latency > 600 {
		state = "degraded"
	}
	st := SimulationState{
		state:            state,
		latency:          int64(latency),
		errorRate:        errorRate,
		lastTransitionAt: time.Now().UTC(),
	}
	s.simulationStore[twinID] = st
	return st
}

func hashInt(s string) int {
	h := 5381
	for i := 0; i < len(s); i++ {
		h = h*33 + int(s[i])
	}
	if h < 0 {
		h = -h
	}
	return h
}

func randString(n int) string {
	chars := "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

// --- Sentinel errors ---

var (

	ErrTwinNotFound   = errors.New("twin not found")
	ErrInvalidInput   = errors.New("invalid input")
	ErrReplayNotFound = errors.New("replay session not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
