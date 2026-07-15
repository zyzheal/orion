package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/efficiency/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("efficiency record not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===== MetricSnapshot =====

func (r *Repository) CreateSnapshot(ctx context.Context, s *models.MetricSnapshot) error {
	s.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_metric_snapshots (id, tenant_id, time_window, deployment_frequency, lead_time_ms, change_failure_rate, mttr_ms, captured_at)
		 VALUES (:id, :tenantId, :timeWindow, :deploymentFrequency, :leadTimeMs, :changeFailureRate, :mttrMs, :capturedAt)`,
		s)
	return err
}

func (r *Repository) ListSnapshotsByTenant(ctx context.Context, tenantID string, limit int) ([]models.MetricSnapshot, error) {
	var snapshots []models.MetricSnapshot
	err := r.db.SelectContext(ctx, &snapshots,
		`SELECT * FROM efficiency_metric_snapshots
		 WHERE tenant_id=$1 ORDER BY captured_at DESC LIMIT $2`,
		tenantID, limit)
	return snapshots, err
}

func (r *Repository) PruneOldSnapshots(ctx context.Context, tenantID string, keep int) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM efficiency_metric_snapshots
		 WHERE id NOT IN (
			 SELECT id FROM efficiency_metric_snapshots
			 WHERE tenant_id=$1 ORDER BY captured_at DESC LIMIT $2
		 ) AND tenant_id=$3`,
		tenantID, keep, tenantID)
	return err
}

// ===== ReportHistory =====

func (r *Repository) CreateReportHistory(ctx context.Context, entry *models.ReportHistoryEntry) error {
	entry.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_report_history (id, tenant_id, report_data, generated_at)
		 VALUES (:id, :tenantId, :reportData, :generatedAt)`,
		entry)
	return err
}

func (r *Repository) ListReportHistory(ctx context.Context, tenantID string, limit int) ([]models.ReportHistoryEntry, error) {
	var entries []models.ReportHistoryEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT * FROM efficiency_report_history
		 WHERE tenant_id=$1 ORDER BY generated_at DESC LIMIT $2`,
		tenantID, limit)
	return entries, err
}

// ===== TeamData =====

func (r *Repository) CreateTeamData(ctx context.Context, t *models.TeamData) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_team_data (id, tenant_id, name, members, pipelines, deployments)
		 VALUES (:id, :tenantId, :name, :members, :pipelines, :deployments)
		 ON CONFLICT (tenant_id, id) DO UPDATE SET
			name=EXCLUDED.name, members=EXCLUDED.members, pipelines=EXCLUDED.pipelines, deployments=EXCLUDED.deployments`,
		t)
	return err
}

func (r *Repository) GetTeamData(ctx context.Context, tenantID, teamID string) (*models.TeamData, error) {
	var t models.TeamData
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM efficiency_team_data WHERE tenant_id=$1 AND id=$2`, tenantID, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &t, err
}

func (r *Repository) ListTeamData(ctx context.Context, tenantID string) ([]models.TeamData, error) {
	var teams []models.TeamData
	err := r.db.SelectContext(ctx, &teams,
		`SELECT * FROM efficiency_team_data WHERE tenant_id=$1`, tenantID)
	return teams, err
}

// ===== ProjectData =====

func (r *Repository) CreateProjectData(ctx context.Context, p *models.ProjectData) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_project_data (id, tenant_id, name, pipelines, deployments, commits)
		 VALUES (:id, :tenantId, :name, :pipelines, :deployments, :commits)
		 ON CONFLICT (tenant_id, id) DO UPDATE SET
			name=EXCLUDED.name, pipelines=EXCLUDED.pipelines, deployments=EXCLUDED.deployments, commits=EXCLUDED.commits`,
		p)
	return err
}

func (r *Repository) GetProjectData(ctx context.Context, tenantID, projectID string) (*models.ProjectData, error) {
	var p models.ProjectData
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM efficiency_project_data WHERE tenant_id=$1 AND id=$2`, tenantID, projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &p, err
}

func (r *Repository) ListProjectData(ctx context.Context, tenantID string) ([]models.ProjectData, error) {
	var projects []models.ProjectData
	err := r.db.SelectContext(ctx, &projects,
		`SELECT * FROM efficiency_project_data WHERE tenant_id=$1`, tenantID)
	return projects, err
}

// ===== GlobalDeployment =====

func (r *Repository) CreateGlobalDeployment(ctx context.Context, d *models.GlobalDeployment) error {
	d.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_global_deployments (id, tenant_id, deployment_data, deployed_at)
		 VALUES (:id, :tenantId, :deploymentData, :deployedAt)`,
		d)
	return err
}

func (r *Repository) ListGlobalDeployments(ctx context.Context, tenantID string) ([]models.GlobalDeployment, error) {
	var depl []models.GlobalDeployment
	err := r.db.SelectContext(ctx, &depl,
		`SELECT * FROM efficiency_global_deployments WHERE tenant_id=$1 ORDER BY deployed_at DESC`, tenantID)
	return depl, err
}

func (r *Repository) DeleteGlobalDeploymentsByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM efficiency_global_deployments WHERE tenant_id=$1`, tenantID)
	return err
}

// ===== GlobalPipeline =====

func (r *Repository) CreateGlobalPipeline(ctx context.Context, p *models.GlobalPipeline) error {
	p.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_global_pipelines (id, tenant_id, pipeline_data, completed_at)
		 VALUES (:id, :tenantId, :pipelineData, :completedAt)`,
		p)
	return err
}

func (r *Repository) ListGlobalPipelines(ctx context.Context, tenantID string) ([]models.GlobalPipeline, error) {
	var pips []models.GlobalPipeline
	err := r.db.SelectContext(ctx, &pips,
		`SELECT * FROM efficiency_global_pipelines WHERE tenant_id=$1 ORDER BY completed_at DESC`, tenantID)
	return pips, err
}

func (r *Repository) DeleteGlobalPipelinesByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM efficiency_global_pipelines WHERE tenant_id=$1`, tenantID)
	return err
}

// ===== Helpers for table existence detection =====

// TableExists checks if a table exists in the current database.
func (r *Repository) TableExists(ctx context.Context, tableName string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`, tableName))
	return exists, err
}
