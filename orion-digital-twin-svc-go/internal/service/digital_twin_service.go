package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"orion/digital-twin-svc-go/internal/models"
	"orion/digital-twin-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrNotFound              = errors.New("not found")
	ErrTwinNotFound          = errors.New("twin not found")
	ErrDigitalTwinNotFound   = ErrTwinNotFound // backward compatibility alias
	ErrNotOwner              = errors.New("twin does not belong to tenant")
	ErrInvalidState          = errors.New("invalid state for this operation")
)

// Service provides business logic for all digital twin operations.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Digital Twin Operations ====================

// Create creates a new digital twin.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	env := req.Environment
	if env == "" {
		env = "dev"
	}
	syncInterval := req.SyncInterval
	if syncInterval <= 0 {
		syncInterval = 60
	}
	entityType := req.EntityType
	if entityType == "" {
		entityType = "service"
	}

	servicesJSON, err := models.MarshalJSONBRaw(req.Services)
	if err != nil {
		return nil, fmt.Errorf("marshal services: %w", err)
	}

	now := time.Now()
	d := &models.DigitalTwin{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Name:              req.Name,
		Description:       req.Description,
		Environment:       env,
		Services:          servicesJSON,
		SyncInterval:      syncInterval,
		DataRetentionDays: 30,
		Status:            "active",
		HealthScore:       100,
		ServiceStates:     models.JSONB{},
		EntityType:        entityType,
		State:             models.JSONB{},
		Config:            models.JSONB{},
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("insert twin: %w", err)
	}
	return d, nil
}

// GetByID retrieves a twin by ID.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTwinNotFound
	}
	return d, nil
}

// List retrieves twins for a tenant with pagination.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.DigitalTwin, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// Count returns the total number of twins for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update updates a digital twin's configuration.
func (s *Service) Update(ctx context.Context, tenantID, id string,
	req *models.UpdateDigitalTwinRequest) (*models.DigitalTwin, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTwinNotFound
	}

	if req.Name != nil {
		d.Name = *req.Name
	}
	if req.Description != nil {
		d.Description = req.Description
	}
	if req.Services != nil {
		servicesJSON, err := models.MarshalJSONBRaw(req.Services)
		if err != nil {
			return nil, fmt.Errorf("marshal services: %w", err)
		}
		d.Services = servicesJSON
	}
	if req.SyncInterval != nil {
		d.SyncInterval = *req.SyncInterval
	}
	if req.DataRetentionDays != nil {
		d.DataRetentionDays = *req.DataRetentionDays
	}

	if err := s.repo.Update(ctx, d); err != nil {
		return nil, fmt.Errorf("update twin: %w", err)
	}
	return d, nil
}

// Delete removes a digital twin.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Sync simulates syncing a twin with the production environment.
func (s *Service) Sync(ctx context.Context, tenantID, id string) (*models.SyncResult, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTwinNotFound
	}

	// Mark as syncing
	if _, err := s.repo.UpdateStatus(ctx, tenantID, id, "syncing"); err != nil {
		return nil, fmt.Errorf("update status: %w", err)
	}

	// Parse services to generate simulated states
	var services []string
	if d.Services != nil {
		_ = json.Unmarshal(d.Services, &services)
	}

	serviceStates := models.JSONB{}
	for _, svc := range services {
		serviceStates[svc] = map[string]interface{}{
			"status": "healthy",
			"latency": rand.Intn(100),
		}
	}
	healthScore := 95 + rand.Intn(5)

	now := time.Now()
	if _, err := s.repo.UpdateServiceStates(ctx, tenantID, id, serviceStates, healthScore, now.Format(time.RFC3339)); err != nil {
		return nil, fmt.Errorf("update service states: %w", err)
	}

	// Restore to active
	if _, err := s.repo.UpdateStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, fmt.Errorf("restore status: %w", err)
	}

	return &models.SyncResult{
		Success:  true,
		SyncedAt: now.Format(time.RFC3339),
	}, nil
}

// GetMetrics returns aggregate metrics for a twin.
func (s *Service) GetMetrics(ctx context.Context, tenantID, id string) (*models.TwinMetrics, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTwinNotFound
	}

	sandboxCount, _ := s.repo.CountSandboxesByTwin(ctx, id)
	recordingCount, _ := s.repo.CountRecordingSessionsByTwin(ctx, id)

	var services []string
	if d.Services != nil {
		_ = json.Unmarshal(d.Services, &services)
	}

	lastSyncAt := ""
	if d.LastSyncAt != nil {
		lastSyncAt = *d.LastSyncAt
	}

	return &models.TwinMetrics{
		HealthScore:    d.HealthScore,
		Status:         d.Status,
		ServiceCount:   len(services),
		LastSyncAt:     lastSyncAt,
		SandboxCount:   sandboxCount,
		RecordingCount: recordingCount,
	}, nil
}

// ==================== Snapshot Operations ====================

// CreateSnapshot creates a new environment snapshot.
func (s *Service) CreateSnapshot(ctx context.Context, tenantID string,
	req *models.CreateSnapshotRequest) (*models.TwinSnapshot, error) {

	// Simulate collecting environment components
	components := []models.SnapshotComponent{
		{Name: "api-gateway", Type: "service", Version: "1.0.0", Replicas: 3, EnvVars: map[string]string{}, ConfigMapRefs: []string{}},
		{Name: "user-service", Type: "service", Version: "2.1.0", Replicas: 2, EnvVars: map[string]string{}, ConfigMapRefs: []string{}},
	}
	componentsJSON, _ := models.MarshalJSONBRaw(components)

	topology := map[string][]string{
		"api-gateway": {"user-service", "order-service"},
		"user-service": {"postgres", "redis"},
	}
	topologyJSON, _ := models.MarshalJSONBRaw(topology)

	snapshot := &models.TwinSnapshot{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        fmt.Sprintf("snapshot-%d", time.Now().UnixMilli()),
		Environment: req.Environment,
		Status:      "ready",
		Components:  componentsJSON,
		Topology:    topologyJSON,
		SizeBytes:   1024000,
		Config:      models.JSONB{},
		Metadata:    models.JSONB{},
		CreatedBy:   req.CreatedBy,
		Note:        req.Note,
		CreatedAt:   time.Now(),
		CompletedAt: timePtr(time.Now()),
	}

	if err := s.repo.CreateSnapshot(ctx, snapshot); err != nil {
		return nil, fmt.Errorf("insert snapshot: %w", err)
	}
	return snapshot, nil
}

// GetSnapshot retrieves a snapshot by ID.
func (s *Service) GetSnapshot(ctx context.Context, id string) (*models.TwinSnapshot, error) {
	snap, err := s.repo.GetSnapshot(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return snap, nil
}

// ListSnapshots lists snapshots for a tenant.
func (s *Service) ListSnapshots(ctx context.Context, tenantID, environment, status string) ([]models.TwinSnapshot, error) {
	return s.repo.ListSnapshots(ctx, tenantID, environment, status)
}

// DeleteSnapshot removes a snapshot.
func (s *Service) DeleteSnapshot(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteSnapshot(ctx, id)
}

// RestoreSnapshot marks a snapshot as restoring.
func (s *Service) RestoreSnapshot(ctx context.Context, id string,
	req *models.RestoreSnapshotRequest) (string, string, error) {
	_, err := s.repo.GetSnapshot(ctx, id)
	if err != nil {
		return "", "", ErrNotFound
	}

	status := "restoring"
	if req.DryRun {
		status = "dry_run"
	}
	if _, err := s.repo.UpdateSnapshot(ctx, id, &status, nil, nil, nil, nil); err != nil {
		return "", "", fmt.Errorf("update snapshot status: %w", err)
	}
	return id, "restoring", nil
}

// ExportSnapshot exports a snapshot as JSON.
func (s *Service) ExportSnapshot(ctx context.Context, id string) (string, int64, error) {
	snap, err := s.repo.GetSnapshot(ctx, id)
	if err != nil {
		return "", 0, ErrNotFound
	}
	yaml, _ := json.MarshalIndent(snap, "", "  ")
	return string(yaml), snap.SizeBytes, nil
}

// ==================== Sandbox Operations ====================

// CreateSandbox creates a sandbox environment for a twin.
func (s *Service) CreateSandbox(ctx context.Context, tenantID, twinID string,
	req *models.CreateSandboxRequest) (*models.TwinSandbox, error) {
	// Verify twin exists and belongs to tenant
	twin, err := s.repo.GetByID(ctx, tenantID, twinID)
	if err != nil {
		return nil, ErrTwinNotFound
	}
	if twin.TenantID != tenantID {
		return nil, ErrNotOwner
	}

	id := uuid.New().String()
	name := fmt.Sprintf("sandbox-%d", time.Now().UnixMilli())
	if req.Name != nil {
		name = *req.Name
	}

	resources := models.JSONB{"cpu": "500m", "memory": "512Mi", "replicas": 1}
	if req.Resources != nil {
		resources = models.JSONB{
			"cpu":      req.Resources.CPU,
			"memory":   req.Resources.Memory,
			"replicas": req.Resources.Replicas,
		}
	}

	envVars := models.JSONB{}
	if req.EnvVars != nil {
		for k, v := range req.EnvVars {
			envVars[k] = v
		}
	}

	networkIsolation := true
	if req.NetworkIsolation != nil {
		networkIsolation = *req.NetworkIsolation
	}

	now := time.Now()
	sandbox := &models.TwinSandbox{
		ID:               id,
		TenantID:         tenantID,
		TwinID:           twinID,
		Name:             name,
		SnapshotID:       req.SnapshotID,
		Status:           "running",
		Endpoint:         fmt.Sprintf("http://sandbox-%s.local:9000", id[:8]),
		Resources:        resources,
		EnvVars:          envVars,
		NetworkIsolation: networkIsolation,
		HealthStatus:     "healthy",
		CreatedAt:        now,
		StartedAt:        timePtr(now),
	}

	if err := s.repo.CreateSandbox(ctx, sandbox); err != nil {
		return nil, fmt.Errorf("insert sandbox: %w", err)
	}
	return sandbox, nil
}

// GetSandbox retrieves a sandbox by ID.
func (s *Service) GetSandbox(ctx context.Context, id string) (*models.TwinSandbox, error) {
	sb, err := s.repo.GetSandbox(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return sb, nil
}

// ListSandboxes lists sandboxes for a twin.
func (s *Service) ListSandboxes(ctx context.Context, twinID string) ([]models.TwinSandbox, error) {
	return s.repo.ListSandboxesByTwin(ctx, twinID)
}

// StopSandbox stops a running sandbox.
func (s *Service) StopSandbox(ctx context.Context, id string) (*models.TwinSandbox, error) {
	sb, err := s.repo.GetSandbox(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sb.Status == "stopped" || sb.Status == "destroying" {
		return nil, ErrInvalidState
	}

	now := time.Now()
	return s.repo.UpdateSandboxStatus(ctx, id, "stopped", &now)
}

// StartSandbox starts a stopped sandbox.
func (s *Service) StartSandbox(ctx context.Context, id string) (*models.TwinSandbox, error) {
	sb, err := s.repo.GetSandbox(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sb.Status != "stopped" {
		return nil, ErrInvalidState
	}

	if _, err := s.repo.UpdateSandboxStatus(ctx, id, "running", nil); err != nil {
		return nil, err
	}

	// Update health and started_at
	now := time.Now()
	return s.repo.UpdateSandboxHealthCheck(ctx, id, "healthy", now)
}

// DestroySandbox destroys a sandbox.
func (s *Service) DestroySandbox(ctx context.Context, id string) (bool, error) {
	_, err := s.repo.GetSandbox(ctx, id)
	if err != nil {
		return false, ErrNotFound
	}
	return s.repo.DeleteSandbox(ctx, id)
}

// HealthCheck performs a health check on a sandbox.
func (s *Service) HealthCheck(ctx context.Context, id string) (*models.TwinSandbox, error) {
	sb, err := s.repo.GetSandbox(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}

	healthStatus := "unknown"
	if sb.Status == "running" {
		healthStatus = "healthy"
	}

	now := time.Now()
	return s.repo.UpdateSandboxHealthCheck(ctx, id, healthStatus, now)
}

// ==================== Recording Session Operations ====================

// StartRecording starts a new traffic recording session.
func (s *Service) StartRecording(ctx context.Context, tenantID, twinID string,
	req *models.StartRecordingRequest) (*models.RecordingSession, error) {

	var filterPatterns models.JSONBRaw
	if req.FilterPatterns != nil {
		filterPatterns, _ = models.MarshalJSONBRaw(req.FilterPatterns)
	}

	session := &models.RecordingSession{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		TwinID:         twinID,
		Name:           req.Name,
		Status:         "active",
		Records:        JSONBRawArray(),
		FilterPatterns: filterPatterns,
		StartedAt:      time.Now(),
	}

	if err := s.repo.CreateRecordingSession(ctx, session); err != nil {
		return nil, fmt.Errorf("insert recording session: %w", err)
	}
	return session, nil
}

// GetRecordingSession retrieves a recording session by ID.
func (s *Service) GetRecordingSession(ctx context.Context, id string) (*models.RecordingSession, error) {
	session, err := s.repo.GetRecordingSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return session, nil
}

// ListRecordingSessions lists recording sessions for a twin.
func (s *Service) ListRecordingSessions(ctx context.Context, twinID string) ([]models.RecordingSession, error) {
	return s.repo.ListRecordingSessionsByTwin(ctx, twinID)
}

// PauseRecording pauses an active recording session.
func (s *Service) PauseRecording(ctx context.Context, id string) (*models.RecordingSession, error) {
	session, err := s.repo.GetRecordingSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if session.Status != "active" {
		return nil, ErrInvalidState
	}

	now := time.Now()
	return s.repo.UpdateRecordingSessionStatus(ctx, id, "paused", &now, nil)
}

// ResumeRecording resumes a paused recording session.
func (s *Service) ResumeRecording(ctx context.Context, id string) (*models.RecordingSession, error) {
	session, err := s.repo.GetRecordingSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if session.Status != "paused" {
		return nil, ErrInvalidState
	}

	return s.repo.UpdateRecordingSessionStatus(ctx, id, "active", nil, nil)
}

// StopRecording stops a recording session.
func (s *Service) StopRecording(ctx context.Context, id string) (*models.RecordingSession, error) {
	session, err := s.repo.GetRecordingSession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if session.Status == "completed" {
		return nil, ErrInvalidState
	}

	now := time.Now()
	return s.repo.UpdateRecordingSessionStatus(ctx, id, "completed", nil, &now)
}

// RecordTraffic adds a traffic record to an active recording session.
func (s *Service) RecordTraffic(ctx context.Context, sessionID, twinID string,
	req *models.RecordTrafficRequest) (*models.TrafficRecordEntry, error) {
	session, err := s.repo.GetRecordingSession(ctx, sessionID)
	if err != nil {
		return nil, ErrNotFound
	}
	if session.Status != "active" {
		return nil, ErrInvalidState
	}

	// Apply filter patterns
	if session.FilterPatterns != nil {
		var patterns []string
		if err := json.Unmarshal(session.FilterPatterns, &patterns); err == nil && len(patterns) > 0 {
			matches := false
			for _, pattern := range patterns {
				if contains(req.Request.Path, pattern) {
					matches = true
					break
				}
			}
			if !matches {
				return nil, nil // filtered out
			}
		}
	}

	entry := models.TrafficRecordEntry{
		ID:        uuid.New().String(),
		TwinID:    twinID,
		Request:   req.Request,
		Response:  req.Response,
		Timestamp: time.Now().Format(time.RFC3339),
		Metadata:  req.Metadata,
	}

	// Append to existing records
	var records []models.TrafficRecordEntry
	if session.Records != nil {
		_ = json.Unmarshal(session.Records, &records)
	}
	records = append(records, entry)

	recordsJSON, err := models.MarshalJSONBRaw(records)
	if err != nil {
		return nil, fmt.Errorf("marshal records: %w", err)
	}

	if err := s.repo.UpdateRecordingSessionRecords(ctx, sessionID, recordsJSON); err != nil {
		return nil, fmt.Errorf("update records: %w", err)
	}

	return &entry, nil
}

// GetRecords returns all traffic records for a recording session.
func (s *Service) GetRecords(ctx context.Context, sessionID string) ([]models.TrafficRecordEntry, error) {
	session, err := s.repo.GetRecordingSession(ctx, sessionID)
	if err != nil {
		return nil, ErrNotFound
	}

	var records []models.TrafficRecordEntry
	if session.Records != nil {
		_ = json.Unmarshal(session.Records, &records)
	}
	return records, nil
}

// DeleteRecordingSession deletes a recording session.
func (s *Service) DeleteRecordingSession(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteRecordingSession(ctx, id)
}

// ==================== Replay Session Operations ====================

// StartReplay starts a new traffic replay session.
func (s *Service) StartReplay(ctx context.Context, tenantID string,
	req *models.StartReplayRequest) (*models.ReplaySession, error) {
	// Validate recording session exists
	recording, err := s.repo.GetRecordingSession(ctx, req.RecordingSessionID)
	if err != nil {
		return nil, ErrNotFound
	}
	if recording.Status != "completed" {
		return nil, ErrInvalidState
	}

	// Count records for total_requests
	var records []models.TrafficRecordEntry
	if recording.Records != nil {
		_ = json.Unmarshal(recording.Records, &records)
	}

	// Apply path filters
	filteredCount := len(records)
	if len(req.FilterPaths) > 0 {
		filteredCount = 0
		for _, r := range records {
			for _, pattern := range req.FilterPaths {
				if contains(r.Request.Path, pattern) {
					filteredCount++
					break
				}
			}
		}
	}

	config := models.JSONB{
		"speed_multiplier": req.SpeedMultiplier,
		"max_concurrency":  req.MaxConcurrency,
		"filter_paths":     req.FilterPaths,
		"target_endpoint":  req.TargetEndpoint,
		"compare_responses": req.CompareResponses,
		"stop_on_failure":  req.StopOnFailure,
	}
	if req.SpeedMultiplier <= 0 {
		config["speed_multiplier"] = 1
	}
	if req.MaxConcurrency <= 0 {
		config["max_concurrency"] = 1
	}

	session := &models.ReplaySession{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		TwinID:             req.TwinID,
		RecordingSessionID: req.RecordingSessionID,
		SandboxEndpoint:    req.SandboxEndpoint,
		Status:             "pending",
		TotalRequests:      filteredCount,
		Results:            JSONBRawArray(),
		Config:             config,
		Progress:           0,
	}

	if err := s.repo.CreateReplaySession(ctx, session); err != nil {
		return nil, fmt.Errorf("insert replay session: %w", err)
	}
	return session, nil
}

// GetReplaySession retrieves a replay session by ID.
func (s *Service) GetReplaySession(ctx context.Context, id string) (*models.ReplaySession, error) {
	session, err := s.repo.GetReplaySession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return session, nil
}

// ListReplaySessions lists replay sessions for a twin.
func (s *Service) ListReplaySessions(ctx context.Context, twinID string) ([]models.ReplaySession, error) {
	return s.repo.ListReplaySessionsByTwin(ctx, twinID)
}

// CancelReplay cancels a running replay session.
func (s *Service) CancelReplay(ctx context.Context, id string) (*models.ReplaySession, error) {
	session, err := s.repo.GetReplaySession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if session.Status != "running" {
		return nil, ErrInvalidState
	}

	now := time.Now()
	return s.repo.UpdateReplaySessionStatus(ctx, id, "cancelled", &now)
}

// UpdateReplayProgress updates the progress of a replay session.
func (s *Service) UpdateReplayProgress(ctx context.Context, id string,
	req *models.UpdateProgressRequest) error {
	return s.repo.UpdateReplayProgress(ctx, id, req.Completed, req.Matched, req.Failed, req.Progress)
}

// CompleteReplay marks a replay session as completed.
func (s *Service) CompleteReplay(ctx context.Context, id string) (*models.ReplaySession, error) {
	_, err := s.repo.GetReplaySession(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}

	// Update progress to 100
	if err := s.repo.UpdateReplayProgress(ctx, id, 0, 0, 0, 100); err != nil {
		return nil, fmt.Errorf("update progress: %w", err)
	}

	now := time.Now()
	return s.repo.UpdateReplaySessionStatus(ctx, id, "completed", &now)
}

// ==================== Helpers ====================

func timePtr(t time.Time) *time.Time {
	return &t
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && len(substr) > 0 && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// JSONBRawArray returns a JSONBRaw containing an empty JSON array.
func JSONBRawArray() models.JSONBRaw {
	return models.JSONBRaw("[]")
}
