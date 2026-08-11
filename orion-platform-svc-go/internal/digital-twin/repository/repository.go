package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/digital-twin/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Digital Twins ---

func (r *Repository) CreateTwin(ctx context.Context, tenantID string, req models.CreateDigitalTwinRequest) (*models.DigitalTwin, error) {
	twin := &models.DigitalTwin{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		ServiceType:   req.ServiceType,
		SourceService: req.SourceService,
		Status:        "active",
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twins (id, tenant_id, name, service_type, source_service, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :service_type, :source_service, :status, :created_at, :updated_at)`, twin)
	if err != nil {
		return nil, err
	}
	return twin, nil
}

func (r *Repository) FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	var twin models.DigitalTwin
	err := r.db.GetContext(ctx, &twin,
		`SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &twin, nil
}

func (r *Repository) FindAllTwins(ctx context.Context, tenantID string) ([]models.DigitalTwin, error) {
	var twins []models.DigitalTwin
	err := r.db.SelectContext(ctx, &twins,
		`SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return twins, nil
}

// --- Snapshots ---

func (r *Repository) CreateSnapshot(ctx context.Context, twinID, name string) (*models.Snapshot, error) {
	snap := &models.Snapshot{
		ID:        uuid.New().String(),
		TwinID:    twinID,
		Name:      name,
		CreatedAt: time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_snapshots (id, twin_id, name, created_at)
		VALUES (:id, :twin_id, :name, :created_at)`, snap)
	if err != nil {
		return nil, err
	}
	return snap, nil
}

// --- Traffic Records ---

func (r *Repository) CreateTrafficRecord(ctx context.Context, in models.CreateTrafficRecordInput) (*models.TrafficRecord, error) {
	record := &models.TrafficRecord{
		ID:           uuid.New().String(),
		TwinID:       in.TwinID,
		Type:         in.Type,
		RequestCount: in.RequestCount,
		Duration:     in.Duration,
		StartedAt:    in.StartedAt,
		CompletedAt:  in.CompletedAt,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_traffic_records (id, twin_id, type, request_count, duration, started_at, completed_at)
		VALUES (:id, :twin_id, :type, :request_count, :duration, :started_at, :completed_at)`, record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (r *Repository) FindTrafficRecordsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.TrafficRecord, error) {
	var records []models.TrafficRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT r.* FROM digital_twin_traffic_records r
		 INNER JOIN digital_twins t ON r.twin_id = t.id
		 WHERE r.twin_id=$1 AND t.tenant_id=$2
		 ORDER BY r.started_at DESC`, twinID, tenantID)
	if err != nil {
		return nil, err
	}
	return records, nil
}

// --- Replay Sessions ---

func (r *Repository) CreateReplaySession(ctx context.Context, in models.CreateReplaySessionInput) (*models.ReplaySession, error) {
	session := &models.ReplaySession{
		ID:                 uuid.New().String(),
		TwinID:             in.TwinID,
		RecordingSessionID: in.RecordingSessionID,
		SandboxEndpoint:    in.SandboxEndpoint,
		Status:             in.Status,
		Progress:           0,
		StartedAt:          in.StartedAt,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_replay_sessions
			(id, twin_id, recording_session_id, sandbox_endpoint, status, progress, started_at, total_requests, completed_requests, matched_requests, failed_requests)
		VALUES (:id, :twin_id, :recording_session_id, :sandbox_endpoint, :status, :progress, :started_at, 0, 0, 0, 0)`,
		session)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (r *Repository) FindReplaySessionsByTwinID(ctx context.Context, tenantID, twinID string) ([]models.ReplaySession, error) {
	var sessions []models.ReplaySession
	err := r.db.SelectContext(ctx, &sessions,
		`SELECT s.* FROM digital_twin_replay_sessions s
		 INNER JOIN digital_twins t ON s.twin_id = t.id
		 WHERE s.twin_id=$1 AND t.tenant_id=$2
		 ORDER BY s.started_at DESC`, twinID, tenantID)
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *Repository) FindReplaySessionById(ctx context.Context, tenantID, id string) (*models.ReplaySession, error) {
	var s models.ReplaySession
	err := r.db.GetContext(ctx, &s,
		`SELECT s.* FROM digital_twin_replay_sessions s
		 INNER JOIN digital_twins t ON s.twin_id = t.id
		 WHERE s.id=$1 AND t.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateReplaySession(ctx context.Context, tenantID, id, status string) (*models.ReplaySession, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE digital_twin_replay_sessions SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err != nil {
		return nil, err
	}
	return r.FindReplaySessionById(ctx, tenantID, id)
}

// --- Sentinel errors ---

func ErrNotFoundMsg(msg string) error {
	return fmt.Errorf("%s: %w", msg, sentinel.NotFound)
}

// FindRecordingSessionByID reads a recording session by id, scanning the JSONB records column.
type recordingSessionRow struct {
	ID          string          `db:"id"`
	TwinID      string          `db:"twin_id"`
	Name        string          `db:"name"`
	Status      string          `db:"status"`
	RecordCount int64           `db:"record_count"`
	RecordsJSON []byte          `db:"records"`
	StartedAt   time.Time       `db:"started_at"`
	CompletedAt *time.Time      `db:"completed_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}

func (r *Repository) FindRecordingSessionByID(ctx context.Context, id string) (*recordingSessionRow, error) {
	var row recordingSessionRow
	err := r.db.GetContext(ctx, &row,
		`SELECT id, twin_id, name, status, record_count, records, started_at, completed_at, updated_at
		 FROM recording_sessions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetRecordingRecordsBySessionID returns the parsed records array for a recording session.
func (r *Repository) GetRecordingRecordsBySessionID(ctx context.Context, id string) ([]interface{}, error) {
	var recordsJSON []byte
	err := r.db.GetContext(ctx, &recordsJSON,
		`SELECT records FROM recording_sessions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	if recordsJSON == nil || len(recordsJSON) == 0 {
		return []interface{}{}, nil
	}
	var records []interface{}
	if err := json.Unmarshal(recordsJSON, &records); err != nil {
		return nil, err
	}
	return records, nil
}
