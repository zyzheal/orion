package repository

import (
	"context"
	"fmt"
	"time"

	"orion/infra-ops-svc-go/internal/digital-twin/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all digital twin entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Digital Twin CRUD ====================

// Create inserts a new digital twin.
func (r *Repository) Create(ctx context.Context, d *models.DigitalTwin) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO digital_twins
			(id, tenant_id, name, description, environment, services, sync_interval,
			 data_retention_days, status, health_score, service_states, entity_type, state, config)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Environment, d.Services,
		d.SyncInterval, d.DataRetentionDays, d.Status, d.HealthScore,
		d.ServiceStates, d.EntityType, d.State, d.Config)
	return err
}

// GetByID retrieves a digital twin by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	var d models.DigitalTwin
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// List retrieves digital twins for a tenant with pagination.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.DigitalTwin, error) {
	var items []models.DigitalTwin
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// Update performs a full update on a digital twin.
func (r *Repository) Update(ctx context.Context, d *models.DigitalTwin) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE digital_twins
		 SET name=$1, description=$2, environment=$3, services=$4, sync_interval=$5,
		     data_retention_days=$6, status=$7, health_score=$8, service_states=$9,
		     entity_type=$10, state=$11, config=$12, updated_at=$13
		 WHERE id=$14 AND tenant_id=$15`,
		d.Name, d.Description, d.Environment, d.Services, d.SyncInterval,
		d.DataRetentionDays, d.Status, d.HealthScore, d.ServiceStates,
		d.EntityType, d.State, d.Config, time.Now(), d.ID, d.TenantID)
	return err
}

// UpdateStatus updates the status and updated_at of a digital twin.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.DigitalTwin, error) {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE digital_twins SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// UpdateServiceStates updates service_states, health_score, and last_sync_at.
func (r *Repository) UpdateServiceStates(ctx context.Context, tenantID, id string,
	serviceStates models.JSONB, healthScore int, lastSyncAt string) (*models.DigitalTwin, error) {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE digital_twins
		 SET service_states=$1, health_score=$2, last_sync_at=$3, updated_at=$4
		 WHERE id=$5 AND tenant_id=$6`,
		serviceStates, healthScore, lastSyncAt, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// UpdateLastSync updates last_sync_at and last_synced.
func (r *Repository) UpdateLastSync(ctx context.Context, tenantID, id, lastSyncAt string, lastSynced time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE digital_twins SET last_sync_at=$1, last_synced=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`,
		lastSyncAt, lastSynced, time.Now(), id, tenantID)
	return err
}

// Delete removes a digital twin.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM digital_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of twins for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM digital_twins WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Twin Snapshot CRUD ====================

// CreateSnapshot inserts a new twin snapshot.
func (r *Repository) CreateSnapshot(ctx context.Context, s *models.TwinSnapshot) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO twin_snapshots
			(id, tenant_id, name, environment, status, components, topology,
			 size_bytes, storage_path, config, metadata, created_by, note)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		s.ID, s.TenantID, s.Name, s.Environment, s.Status, s.Components,
		s.Topology, s.SizeBytes, s.StoragePath, s.Config, s.Metadata,
		s.CreatedBy, s.Note)
	return err
}

// GetSnapshot retrieves a snapshot by ID.
func (r *Repository) GetSnapshot(ctx context.Context, id string) (*models.TwinSnapshot, error) {
	var s models.TwinSnapshot
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM twin_snapshots WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListSnapshots retrieves snapshots for a tenant with optional filters.
func (r *Repository) ListSnapshots(ctx context.Context, tenantID string,
	environment, status string) ([]models.TwinSnapshot, error) {
	query := `SELECT * FROM twin_snapshots WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if environment != "" {
		query += fmt.Sprintf(" AND environment=$%d", argIdx)
		args = append(args, environment)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	var items []models.TwinSnapshot
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateSnapshot updates a twin snapshot.
func (r *Repository) UpdateSnapshot(ctx context.Context, id string,
	status *string, components, topology models.JSONBRaw,
	sizeBytes *int64, completedAt *time.Time) (*models.TwinSnapshot, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE twin_snapshots
		 SET status=COALESCE($2, status),
		     components=COALESCE($3, components),
		     topology=COALESCE($4, topology),
		     size_bytes=COALESCE($5, size_bytes),
		     completed_at=COALESCE($6, completed_at)
		 WHERE id=$1`,
		id, status, components, topology, sizeBytes, completedAt)
	if err != nil {
		return nil, err
	}
	return r.GetSnapshot(ctx, id)
}

// DeleteSnapshot removes a twin snapshot.
func (r *Repository) DeleteSnapshot(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM twin_snapshots WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// ==================== Sandbox CRUD ====================

// CreateSandbox inserts a new sandbox.
func (r *Repository) CreateSandbox(ctx context.Context, s *models.TwinSandbox) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO twin_sandboxes
			(id, tenant_id, twin_id, name, snapshot_id, status, endpoint,
			 resources, env_vars, network_isolation, health_status, started_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		s.ID, s.TenantID, s.TwinID, s.Name, s.SnapshotID, s.Status,
		s.Endpoint, s.Resources, s.EnvVars, s.NetworkIsolation,
		s.HealthStatus, s.StartedAt)
	return err
}

// GetSandbox retrieves a sandbox by ID.
func (r *Repository) GetSandbox(ctx context.Context, id string) (*models.TwinSandbox, error) {
	var s models.TwinSandbox
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM twin_sandboxes WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListSandboxesByTwin retrieves all sandboxes for a twin.
func (r *Repository) ListSandboxesByTwin(ctx context.Context, twinID string) ([]models.TwinSandbox, error) {
	var items []models.TwinSandbox
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM twin_sandboxes WHERE twin_id=$1 ORDER BY created_at DESC`, twinID)
	return items, err
}

// ListSandboxesByTenant retrieves all sandboxes for a tenant.
func (r *Repository) ListSandboxesByTenant(ctx context.Context, tenantID string) ([]models.TwinSandbox, error) {
	var items []models.TwinSandbox
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM twin_sandboxes WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// UpdateSandboxStatus updates sandbox status and related timestamps.
func (r *Repository) UpdateSandboxStatus(ctx context.Context, id, status string,
	stoppedAt *time.Time) (*models.TwinSandbox, error) {
	if status == "stopped" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE twin_sandboxes SET status=$1, stopped_at=$2, health_status='unknown' WHERE id=$3`,
			status, stoppedAt, id)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := r.db.ExecContext(ctx,
			`UPDATE twin_sandboxes SET status=$1, stopped_at=NULL WHERE id=$2`,
			status, id)
		if err != nil {
			return nil, err
		}
	}
	return r.GetSandbox(ctx, id)
}

// UpdateSandboxHealthCheck updates health status and last health check time.
func (r *Repository) UpdateSandboxHealthCheck(ctx context.Context, id, healthStatus string,
	lastHealthCheck time.Time) (*models.TwinSandbox, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE twin_sandboxes SET health_status=$1, last_health_check=$2 WHERE id=$3`,
		healthStatus, lastHealthCheck, id)
	if err != nil {
		return nil, err
	}
	return r.GetSandbox(ctx, id)
}

// DeleteSandbox removes a sandbox.
func (r *Repository) DeleteSandbox(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM twin_sandboxes WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// CountSandboxesByTwin counts sandboxes for a twin.
func (r *Repository) CountSandboxesByTwin(ctx context.Context, twinID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM twin_sandboxes WHERE twin_id=$1`, twinID)
	return count, err
}

// ==================== Recording Session CRUD ====================

// CreateRecordingSession inserts a new recording session.
func (r *Repository) CreateRecordingSession(ctx context.Context, s *models.RecordingSession) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO recording_sessions
			(id, tenant_id, twin_id, name, status, records, filter_patterns)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.TenantID, s.TwinID, s.Name, s.Status, s.Records, s.FilterPatterns)
	return err
}

// GetRecordingSession retrieves a recording session by ID.
func (r *Repository) GetRecordingSession(ctx context.Context, id string) (*models.RecordingSession, error) {
	var s models.RecordingSession
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM recording_sessions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListRecordingSessionsByTwin retrieves recording sessions for a twin.
func (r *Repository) ListRecordingSessionsByTwin(ctx context.Context, twinID string) ([]models.RecordingSession, error) {
	var items []models.RecordingSession
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM recording_sessions WHERE twin_id=$1 ORDER BY started_at DESC`, twinID)
	return items, err
}

// ListRecordingSessionsByTenant retrieves all recording sessions for a tenant.
func (r *Repository) ListRecordingSessionsByTenant(ctx context.Context, tenantID string) ([]models.RecordingSession, error) {
	var items []models.RecordingSession
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM recording_sessions WHERE tenant_id=$1 ORDER BY started_at DESC`, tenantID)
	return items, err
}

// UpdateRecordingSessionStatus updates the status and timestamps of a recording session.
func (r *Repository) UpdateRecordingSessionStatus(ctx context.Context, id, status string,
	pausedAt, completedAt *time.Time) (*models.RecordingSession, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE recording_sessions SET status=$1, paused_at=$2, completed_at=$3 WHERE id=$4`,
		status, pausedAt, completedAt, id)
	if err != nil {
		return nil, err
	}
	return r.GetRecordingSession(ctx, id)
}

// UpdateRecordingSessionRecords replaces the records JSONB array.
func (r *Repository) UpdateRecordingSessionRecords(ctx context.Context, id string, records models.JSONBRaw) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE recording_sessions SET records=$1 WHERE id=$2`, records, id)
	return err
}

// DeleteRecordingSession removes a recording session.
func (r *Repository) DeleteRecordingSession(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM recording_sessions WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// CountRecordingSessionsByTwin counts recording sessions for a twin.
func (r *Repository) CountRecordingSessionsByTwin(ctx context.Context, twinID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM recording_sessions WHERE twin_id=$1`, twinID)
	return count, err
}

// ==================== Replay Session CRUD ====================

// CreateReplaySession inserts a new replay session.
func (r *Repository) CreateReplaySession(ctx context.Context, s *models.ReplaySession) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO replay_sessions
			(id, tenant_id, twin_id, recording_session_id, sandbox_endpoint,
			 status, total_requests, config, progress)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		s.ID, s.TenantID, s.TwinID, s.RecordingSessionID, s.SandboxEndpoint,
		s.Status, s.TotalRequests, s.Config, s.Progress)
	return err
}

// GetReplaySession retrieves a replay session by ID.
func (r *Repository) GetReplaySession(ctx context.Context, id string) (*models.ReplaySession, error) {
	var s models.ReplaySession
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM replay_sessions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListReplaySessionsByTwin retrieves replay sessions for a twin.
func (r *Repository) ListReplaySessionsByTwin(ctx context.Context, twinID string) ([]models.ReplaySession, error) {
	var items []models.ReplaySession
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM replay_sessions WHERE twin_id=$1 ORDER BY started_at DESC NULLS LAST`, twinID)
	return items, err
}

// ListReplaySessionsByTenant retrieves all replay sessions for a tenant.
func (r *Repository) ListReplaySessionsByTenant(ctx context.Context, tenantID string) ([]models.ReplaySession, error) {
	var items []models.ReplaySession
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM replay_sessions WHERE tenant_id=$1 ORDER BY started_at DESC NULLS LAST`, tenantID)
	return items, err
}

// UpdateReplaySessionStatus updates the status and completed_at of a replay session.
func (r *Repository) UpdateReplaySessionStatus(ctx context.Context, id, status string,
	completedAt *time.Time) (*models.ReplaySession, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE replay_sessions SET status=$1, completed_at=$2 WHERE id=$3`,
		status, completedAt, id)
	if err != nil {
		return nil, err
	}
	return r.GetReplaySession(ctx, id)
}

// SetReplaySessionStartedAt sets the started_at timestamp and marks as running.
func (r *Repository) SetReplaySessionStartedAt(ctx context.Context, id string, startedAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE replay_sessions SET started_at=$1, status='running' WHERE id=$2`,
		startedAt, id)
	return err
}

// UpdateReplayProgress updates progress counters.
func (r *Repository) UpdateReplayProgress(ctx context.Context, id string,
	completed, matched, failed, progress int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE replay_sessions
		 SET completed_requests=$1, matched_requests=$2, failed_requests=$3, progress=$4
		 WHERE id=$5`,
		completed, matched, failed, progress, id)
	return err
}

// AddReplayResults appends results to the results JSONB array.
func (r *Repository) AddReplayResults(ctx context.Context, id string, newResults models.JSONBRaw) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE replay_sessions
		 SET results = (COALESCE(results, '[]'::jsonb) || $1::jsonb)
		 WHERE id=$2`,
		newResults, id)
	return err
}

// DeleteReplaySession removes a replay session.
func (r *Repository) DeleteReplaySession(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM replay_sessions WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
