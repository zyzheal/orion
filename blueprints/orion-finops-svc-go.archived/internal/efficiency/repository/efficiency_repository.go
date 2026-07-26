package repository

import (
	"context"
	"time"

	"orion/finops-svc-go/internal/efficiency/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides all database operations for the efficiency service.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Efficiency Metrics (CRUD) ====================

// Create inserts a new efficiency metric.
func (r *Repository) Create(ctx context.Context, d *models.EfficiencyMetric) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_metrics (id, tenant_id, name, metric_type, value, target, unit, period)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		d.ID, d.TenantID, d.Name, d.MetricType, d.Value, d.Target, d.Unit, d.Period)
	return err
}

// List returns paginated efficiency metrics for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.EfficiencyMetric, error) {
	var items []models.EfficiencyMetric
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, metric_type, value, target, unit, period, created_at
		 FROM efficiency_metrics
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a single efficiency metric by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.EfficiencyMetric, error) {
	var d models.EfficiencyMetric
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, metric_type, value, target, unit, period, created_at
		 FROM efficiency_metrics
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes an efficiency metric by ID and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM efficiency_metrics WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	return err
}

// Count returns the total number of efficiency metrics for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM efficiency_metrics WHERE tenant_id = $1`,
		tenantID)
	return count, err
}

// ==================== Pipeline Records ====================

// CreatePipelineRecord inserts a pipeline completion record.
func (r *Repository) CreatePipelineRecord(ctx context.Context, d *models.PipelineRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_pipeline_records
		 (id, tenant_id, run_id, pipeline_id, status, trigger_type, git_ref, git_sha, duration_ms, completed_at, synced_to_clickhouse)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		d.ID, d.TenantID, d.RunID, d.PipelineID, d.Status, d.TriggerType,
		d.GitRef, d.GitSHA, d.DurationMs, d.CompletedAt, d.SyncedToClickhouse)
	return err
}

// ListPipelineRecords returns pipeline records for a tenant, optionally filtered by since time.
func (r *Repository) ListPipelineRecords(ctx context.Context, tenantID string, since *time.Time) ([]models.PipelineRecord, error) {
	var items []models.PipelineRecord
	if since != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, run_id, pipeline_id, status, trigger_type, git_ref, git_sha, duration_ms, completed_at, synced_to_clickhouse, synced_at
			 FROM efficiency_pipeline_records
			 WHERE tenant_id = $1 AND completed_at >= $2
			 ORDER BY completed_at DESC`,
			tenantID, *since)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, run_id, pipeline_id, status, trigger_type, git_ref, git_sha, duration_ms, completed_at, synced_to_clickhouse, synced_at
		 FROM efficiency_pipeline_records
		 WHERE tenant_id = $1
		 ORDER BY completed_at DESC`,
		tenantID)
	return items, err
}

// FindUnsyncedPipelineRecords returns pipeline records not yet synced to ClickHouse.
func (r *Repository) FindUnsyncedPipelineRecords(ctx context.Context, limit int) ([]models.PipelineRecord, error) {
	var items []models.PipelineRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, run_id, pipeline_id, status, trigger_type, git_ref, git_sha, duration_ms, completed_at, synced_to_clickhouse, synced_at
		 FROM efficiency_pipeline_records
		 WHERE synced_to_clickhouse = FALSE
		 ORDER BY completed_at ASC
		 LIMIT $1`,
		limit)
	return items, err
}

// MarkPipelineSynced marks a pipeline record as synced to ClickHouse.
func (r *Repository) MarkPipelineSynced(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE efficiency_pipeline_records
		 SET synced_to_clickhouse = TRUE, synced_at = NOW()
		 WHERE id = $1`,
		id)
	return err
}

// ==================== Deployment Records ====================

// CreateDeploymentRecord inserts a deployment record.
func (r *Repository) CreateDeploymentRecord(ctx context.Context, d *models.DeploymentRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_deployment_records
		 (id, tenant_id, deployment_id, service, environment, status, version, duration_ms, deployed_at, recovery_time_ms, commit_sha, commit_committed_at, synced_to_clickhouse)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		d.ID, d.TenantID, d.DeploymentID, d.Service, d.Environment, d.Status,
		d.Version, d.DurationMs, d.DeployedAt, d.RecoveryTimeMs,
		d.CommitSHA, nullTime(d.CommitCommittedAt), d.SyncedToClickhouse)
	return err
}

// ListDeploymentRecords returns deployment records for a tenant, optionally filtered by since time.
func (r *Repository) ListDeploymentRecords(ctx context.Context, tenantID string, since *time.Time) ([]models.DeploymentRecord, error) {
	var items []models.DeploymentRecord
	if since != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, deployment_id, service, environment, status, version, duration_ms, deployed_at, recovery_time_ms, commit_sha, commit_committed_at, synced_to_clickhouse, synced_at
			 FROM efficiency_deployment_records
			 WHERE tenant_id = $1 AND deployed_at >= $2
			 ORDER BY deployed_at DESC`,
			tenantID, *since)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, deployment_id, service, environment, status, version, duration_ms, deployed_at, recovery_time_ms, commit_sha, commit_committed_at, synced_to_clickhouse, synced_at
		 FROM efficiency_deployment_records
		 WHERE tenant_id = $1
		 ORDER BY deployed_at DESC`,
		tenantID)
	return items, err
}

// FindUnsyncedDeploymentRecords returns deployment records not yet synced to ClickHouse.
func (r *Repository) FindUnsyncedDeploymentRecords(ctx context.Context, limit int) ([]models.DeploymentRecord, error) {
	var items []models.DeploymentRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, deployment_id, service, environment, status, version, duration_ms, deployed_at, recovery_time_ms, commit_sha, commit_committed_at, synced_to_clickhouse, synced_at
		 FROM efficiency_deployment_records
		 WHERE synced_to_clickhouse = FALSE
		 ORDER BY deployed_at ASC
		 LIMIT $1`,
		limit)
	return items, err
}

// MarkDeploymentSynced marks a deployment record as synced to ClickHouse.
func (r *Repository) MarkDeploymentSynced(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE efficiency_deployment_records
		 SET synced_to_clickhouse = TRUE, synced_at = NOW()
		 WHERE id = $1`,
		id)
	return err
}

// ==================== Incident Records ====================

// CreateIncidentRecord inserts an incident record.
func (r *Repository) CreateIncidentRecord(ctx context.Context, d *models.IncidentRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_incident_records
		 (id, tenant_id, deployment_id, pipeline_run_id, type, severity, status, detected_at, acknowledged_at, resolved_at, recovery_time_ms, service, environment)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		d.ID, d.TenantID, d.DeploymentID, d.PipelineRunID, d.Type, d.Severity,
		d.Status, d.DetectedAt, nullTime(d.AcknowledgedAt), nullTime(d.ResolvedAt),
		d.RecoveryTimeMs, d.Service, d.Environment)
	return err
}

// ListIncidentRecords returns incident records for a tenant, optionally filtered by since time.
func (r *Repository) ListIncidentRecords(ctx context.Context, tenantID string, since *time.Time) ([]models.IncidentRecord, error) {
	var items []models.IncidentRecord
	if since != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, deployment_id, pipeline_run_id, type, severity, status, detected_at, acknowledged_at, resolved_at, recovery_time_ms, service, environment
			 FROM efficiency_incident_records
			 WHERE tenant_id = $1 AND detected_at >= $2
			 ORDER BY detected_at DESC`,
			tenantID, *since)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, deployment_id, pipeline_run_id, type, severity, status, detected_at, acknowledged_at, resolved_at, recovery_time_ms, service, environment
		 FROM efficiency_incident_records
		 WHERE tenant_id = $1
		 ORDER BY detected_at DESC`,
		tenantID)
	return items, err
}

// ==================== Metric Snapshots ====================

// CreateSnapshot inserts a metric snapshot for trend tracking.
func (r *Repository) CreateSnapshot(ctx context.Context, d *models.MetricSnapshot) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_metric_snapshots
		 (id, tenant_id, time_window, deployment_frequency, lead_time_ms, change_failure_rate, mttr_ms, captured_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		d.ID, d.TenantID, d.TimeWindow, d.DeploymentFrequency, d.LeadTimeMs,
		d.ChangeFailureRate, d.MttrMs, d.CapturedAt)
	return err
}

// ListSnapshots returns the most recent snapshots for a tenant.
func (r *Repository) ListSnapshots(ctx context.Context, tenantID string, limit int) ([]models.MetricSnapshot, error) {
	var items []models.MetricSnapshot
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, time_window, deployment_frequency, lead_time_ms, change_failure_rate, mttr_ms, captured_at
		 FROM efficiency_metric_snapshots
		 WHERE tenant_id = $1
		 ORDER BY captured_at DESC
		 LIMIT $2`,
		tenantID, limit)
	return items, err
}

// PruneOldSnapshots deletes old snapshots, keeping only the most recent N for a tenant.
func (r *Repository) PruneOldSnapshots(ctx context.Context, tenantID string, keepCount int) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM efficiency_metric_snapshots
		 WHERE tenant_id = $1 AND id NOT IN (
		   SELECT id FROM efficiency_metric_snapshots
		   WHERE tenant_id = $1
		   ORDER BY captured_at DESC
		   LIMIT $2
		 )`,
		tenantID, keepCount)
	return err
}

// ==================== Scenarios ====================

// CreateScenario inserts a cached dashboard scenario.
func (r *Repository) CreateScenario(ctx context.Context, d *models.Scenario) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_scenarios
		 (id, tenant_id, scenario_id, name, description, category, widgets, time_range, summary, cache_key, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		d.ID, d.TenantID, d.ScenarioID, d.Name, d.Description, d.Category,
		d.Widgets, d.TimeRange, d.Summary, d.CacheKey, d.ExpiresAt)
	return err
}

// FindScenarioByCacheKey looks up a cached scenario by its cache key.
func (r *Repository) FindScenarioByCacheKey(ctx context.Context, cacheKey string) (*models.Scenario, error) {
	var s models.Scenario
	err := r.db.GetContext(ctx, &s,
		`SELECT id, tenant_id, scenario_id, name, description, category, widgets, time_range, summary, cache_key, expires_at
		 FROM efficiency_scenarios
		 WHERE cache_key = $1 AND expires_at > NOW()`,
		cacheKey)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ==================== Weekly Reports ====================

// CreateWeeklyReport inserts a weekly report.
func (r *Repository) CreateWeeklyReport(ctx context.Context, d *models.WeeklyReport) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO weekly_reports (id, team_id, week_start, week_end, report_data)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (id) DO NOTHING`,
		d.ID, d.TeamID, d.WeekStart, d.WeekEnd, d.ReportData)
	return err
}

// ListWeeklyReports returns past weekly reports, optionally filtered by team.
func (r *Repository) ListWeeklyReports(ctx context.Context, teamID string, limit int) ([]models.WeeklyReport, error) {
	var items []models.WeeklyReport
	if teamID != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, team_id, week_start, week_end, report_data, created_at
			 FROM weekly_reports
			 WHERE team_id = $1
			 ORDER BY week_start DESC
			 LIMIT $2`,
			teamID, limit)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, team_id, week_start, week_end, report_data, created_at
		 FROM weekly_reports
		 ORDER BY week_start DESC
		 LIMIT $1`,
		limit)
	return items, err
}

// GetWeeklyReport returns a single weekly report by ID.
func (r *Repository) GetWeeklyReport(ctx context.Context, id string) (*models.WeeklyReport, error) {
	var d models.WeeklyReport
	err := r.db.GetContext(ctx, &d,
		`SELECT id, team_id, week_start, week_end, report_data, created_at
		 FROM weekly_reports
		 WHERE id = $1`,
		id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ==================== Team Data ====================

// CreateTeamData inserts team registration data.
func (r *Repository) CreateTeamData(ctx context.Context, d *models.TeamData) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_team_data (id, tenant_id, name, members, pipelines, deployments)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO UPDATE SET name = $3, members = $4, pipelines = $5, deployments = $6`,
		d.ID, d.TenantID, d.Name, d.Members, d.Pipelines, d.Deployments)
	return err
}

// GetTeamData returns team data by ID.
func (r *Repository) GetTeamData(ctx context.Context, teamID string) (*models.TeamData, error) {
	var d models.TeamData
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, members, pipelines, deployments
		 FROM efficiency_team_data
		 WHERE id = $1`,
		teamID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ==================== Project Data ====================

// CreateProjectData inserts project registration data.
func (r *Repository) CreateProjectData(ctx context.Context, d *models.ProjectData) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_project_data (id, tenant_id, name, pipelines, deployments, commits)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO UPDATE SET name = $3, pipelines = $4, deployments = $5, commits = $6`,
		d.ID, d.TenantID, d.Name, d.Pipelines, d.Deployments, d.Commits)
	return err
}

// GetProjectData returns project data by ID.
func (r *Repository) GetProjectData(ctx context.Context, projectID string) (*models.ProjectData, error) {
	var d models.ProjectData
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, pipelines, deployments, commits
		 FROM efficiency_project_data
		 WHERE id = $1`,
		projectID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ==================== Global Deployments ====================

// CreateGlobalDeployment inserts a global deployment record for report generation.
func (r *Repository) CreateGlobalDeployment(ctx context.Context, d *models.GlobalDeployment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_global_deployments (id, tenant_id, deployment_data, deployed_at)
		 VALUES ($1, $2, $3, $4)`,
		d.ID, d.TenantID, d.DeploymentData, d.DeployedAt)
	return err
}

// ListGlobalDeployments returns global deployments for a tenant, optionally filtered by since.
func (r *Repository) ListGlobalDeployments(ctx context.Context, tenantID string, since *time.Time) ([]models.GlobalDeployment, error) {
	var items []models.GlobalDeployment
	if since != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, deployment_data, deployed_at
			 FROM efficiency_global_deployments
			 WHERE tenant_id = $1 AND deployed_at >= $2
			 ORDER BY deployed_at DESC`,
			tenantID, *since)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, deployment_data, deployed_at
		 FROM efficiency_global_deployments
		 WHERE tenant_id = $1
		 ORDER BY deployed_at DESC`,
		tenantID)
	return items, err
}

// ==================== Global Pipelines ====================

// CreateGlobalPipeline inserts a global pipeline record for report generation.
func (r *Repository) CreateGlobalPipeline(ctx context.Context, d *models.GlobalPipeline) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_global_pipelines (id, tenant_id, pipeline_data, completed_at)
		 VALUES ($1, $2, $3, $4)`,
		d.ID, d.TenantID, d.PipelineData, d.CompletedAt)
	return err
}

// ListGlobalPipelines returns global pipeline records for a tenant, optionally filtered by since.
func (r *Repository) ListGlobalPipelines(ctx context.Context, tenantID string, since *time.Time) ([]models.GlobalPipeline, error) {
	var items []models.GlobalPipeline
	if since != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, pipeline_data, completed_at
			 FROM efficiency_global_pipelines
			 WHERE tenant_id = $1 AND completed_at >= $2
			 ORDER BY completed_at DESC`,
			tenantID, *since)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, pipeline_data, completed_at
		 FROM efficiency_global_pipelines
		 WHERE tenant_id = $1
		 ORDER BY completed_at DESC`,
		tenantID)
	return items, err
}

// ==================== Report History ====================

// CreateReportHistory inserts a generated report into history.
func (r *Repository) CreateReportHistory(ctx context.Context, d *models.ReportHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO efficiency_report_history (id, tenant_id, report_data, generated_at)
		 VALUES ($1, $2, $3, $4)`,
		d.ID, d.TenantID, d.ReportData, d.GeneratedAt)
	return err
}

// ListReportHistory returns report history for a tenant.
func (r *Repository) ListReportHistory(ctx context.Context, tenantID string, limit int) ([]models.ReportHistory, error) {
	var items []models.ReportHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, report_data, generated_at
		 FROM efficiency_report_history
		 WHERE tenant_id = $1
		 ORDER BY generated_at DESC
		 LIMIT $2`,
		tenantID, limit)
	return items, err
}

// ==================== Helpers ====================

// nullTime returns a nil *time.Time if the time is zero, otherwise returns a pointer.
func nullTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}
