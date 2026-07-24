package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ci-cd/canary/models"

	"github.com/jmoiron/sqlx"
)

// ==================== CanaryRepository ====================

// CanaryRepository provides data access for canary deployments and metrics.
type CanaryRepository struct {
	db *sqlx.DB
}

// NewCanaryRepository creates a new CanaryRepository.
func NewCanaryRepository(db *sqlx.DB) *CanaryRepository {
	return &CanaryRepository{db: db}
}

// Create inserts a new canary deployment.
func (r *CanaryRepository) Create(ctx context.Context, c *models.Canary) error {
	query := `
		INSERT INTO canaries (tenant_id, deployment_id, service_name, version, status, weight, target_weight)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		c.TenantID, c.DeploymentID, c.ServiceName, c.Version,
		c.Status, c.Weight, c.TargetWeight,
	).Scan(&c.ID, &c.CreatedAt)
}

// GetByID retrieves a canary deployment by tenant and ID.
func (r *CanaryRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	var c models.Canary
	query := `SELECT * FROM canaries WHERE tenant_id = $1 AND id = $2`
	err := r.db.GetContext(ctx, &c, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("canary not found: %w", err)
	}
	return &c, nil
}

// GetByIDOnly retrieves a canary deployment by ID alone (no tenant filter).
func (r *CanaryRepository) GetByIDOnly(ctx context.Context, id string) (*models.Canary, error) {
	var c models.Canary
	query := `SELECT * FROM canaries WHERE id = $1`
	err := r.db.GetContext(ctx, &c, query, id)
	if err != nil {
		return nil, fmt.Errorf("canary not found: %w", err)
	}
	return &c, nil
}

// ListByTenant retrieves canary deployments for a tenant with pagination.
func (r *CanaryRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.Canary, error) {
	var canaries []models.Canary
	query := `SELECT * FROM canaries WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &canaries, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return canaries, nil
}

// ListByTenantAndStatus retrieves canary deployments filtered by status.
func (r *CanaryRepository) ListByTenantAndStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.Canary, error) {
	var canaries []models.Canary
	query := `SELECT * FROM canaries WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	err := r.db.SelectContext(ctx, &canaries, query, tenantID, status, limit, offset)
	if err != nil {
		return nil, err
	}
	return canaries, nil
}

// UpdateStatus updates the status of a canary deployment.
func (r *CanaryRepository) UpdateStatus(ctx context.Context, id string, status models.CanaryStatus) error {
	query := `UPDATE canaries SET status = $1, completed_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// UpdateWeight updates the traffic weight of a canary deployment.
func (r *CanaryRepository) UpdateWeight(ctx context.Context, id string, weight int) error {
	query := `UPDATE canaries SET weight = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, weight, id)
	return err
}

// AddMetric inserts a raw metric sample.
func (r *CanaryRepository) AddMetric(ctx context.Context, m *models.CanaryMetric) error {
	query := `
		INSERT INTO canary_metrics (canary_id, metric_name, value, source, timestamp)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		m.CanaryID, m.MetricName, m.Value, m.Source, m.Timestamp,
	).Scan(&m.ID)
}

// GetMetrics retrieves all metric samples for a canary.
func (r *CanaryRepository) GetMetrics(ctx context.Context, canaryID string) ([]models.CanaryMetric, error) {
	var metrics []models.CanaryMetric
	query := `SELECT * FROM canary_metrics WHERE canary_id = $1 ORDER BY timestamp`
	err := r.db.SelectContext(ctx, &metrics, query, canaryID)
	if err != nil {
		return nil, err
	}
	return metrics, nil
}

// Delete removes a canary deployment and its cascaded children.
func (r *CanaryRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM canaries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of canary deployments for a tenant.
func (r *CanaryRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM canaries WHERE tenant_id=$1`, tenantID)
	return count, err
}

// AddAnalysis inserts a simple canary analysis result.
func (r *CanaryRepository) AddAnalysis(ctx context.Context, a *models.CanaryAnalysis) error {
	query := `
		INSERT INTO canary_analysis (canary_id, score, verdict, details)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		a.CanaryID, a.Score, a.Verdict, a.Details,
	).Scan(&a.ID, &a.CreatedAt)
}

// GetAnalysis retrieves analysis results for a canary.
func (r *CanaryRepository) GetAnalysis(ctx context.Context, canaryID string) ([]models.CanaryAnalysis, error) {
	var analyses []models.CanaryAnalysis
	query := `SELECT * FROM canary_analysis WHERE canary_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &analyses, query, canaryID)
	if err != nil {
		return nil, err
	}
	return analyses, nil
}

// ==================== CanaryAnalysisRunRepository ====================

// CanaryAnalysisRunRepository provides data access for ML analysis runs.
type CanaryAnalysisRunRepository struct {
	db *sqlx.DB
}

// NewCanaryAnalysisRunRepository creates a new run repository.
func NewCanaryAnalysisRunRepository(db *sqlx.DB) *CanaryAnalysisRunRepository {
	return &CanaryAnalysisRunRepository{db: db}
}

// Create inserts a new analysis run.
func (r *CanaryAnalysisRunRepository) Create(ctx context.Context, run *models.CanaryAnalysisRun) error {
	query := `
		INSERT INTO canary_analysis_runs (id, deployment_id, run_number, traffic_split, status, confidence, decision, started_at, completed_at, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		run.ID, run.DeploymentID, run.RunNumber, run.TrafficSplit,
		run.Status, run.Confidence, run.Decision,
		run.StartedAt, run.CompletedAt, run.DurationMs,
	).Scan(&run.ID)
}

// FindByID retrieves an analysis run by ID.
func (r *CanaryAnalysisRunRepository) FindByID(ctx context.Context, id string) (*models.CanaryAnalysisRun, error) {
	var run models.CanaryAnalysisRun
	query := `SELECT * FROM canary_analysis_runs WHERE id = $1`
	err := r.db.GetContext(ctx, &run, query, id)
	if err != nil {
		return nil, fmt.Errorf("analysis run not found: %w", err)
	}
	return &run, nil
}

// FindByDeployment retrieves all analysis runs for a deployment.
func (r *CanaryAnalysisRunRepository) FindByDeployment(ctx context.Context, deploymentID string) ([]models.CanaryAnalysisRun, error) {
	var runs []models.CanaryAnalysisRun
	query := `SELECT * FROM canary_analysis_runs WHERE deployment_id = $1 ORDER BY started_at DESC`
	err := r.db.SelectContext(ctx, &runs, query, deploymentID)
	if err != nil {
		return nil, err
	}
	return runs, nil
}

// FindByStatus retrieves all analysis runs with a given status.
func (r *CanaryAnalysisRunRepository) FindByStatus(ctx context.Context, status string) ([]models.CanaryAnalysisRun, error) {
	var runs []models.CanaryAnalysisRun
	query := `SELECT * FROM canary_analysis_runs WHERE status = $1 ORDER BY started_at DESC`
	err := r.db.SelectContext(ctx, &runs, query, status)
	if err != nil {
		return nil, err
	}
	return runs, nil
}

// FindAll retrieves all analysis runs with a limit.
func (r *CanaryAnalysisRunRepository) FindAll(ctx context.Context, limit int) ([]models.CanaryAnalysisRun, error) {
	var runs []models.CanaryAnalysisRun
	query := `SELECT * FROM canary_analysis_runs ORDER BY started_at DESC LIMIT $1`
	err := r.db.SelectContext(ctx, &runs, query, limit)
	if err != nil {
		return nil, err
	}
	return runs, nil
}

// UpdateRunStatus updates the status, decision, confidence, and completion time of a run.
func (r *CanaryAnalysisRunRepository) UpdateRunStatus(ctx context.Context, id string, status models.AnalysisStatus, decision models.AnalysisDecision, confidence float64, completedAt time.Time) error {
	query := `
		UPDATE canary_analysis_runs
		SET status = $1, decision = $2, confidence = $3, completed_at = $4,
		    duration_ms = EXTRACT(EPOCH FROM ($4 - started_at)) * 1000
		WHERE id = $5
	`
	_, err := r.db.ExecContext(ctx, query, status, decision, confidence, completedAt, id)
	return err
}

// ==================== CanaryMetricResultRepository ====================

// CanaryMetricResultRepository provides data access for metric analysis results.
type CanaryMetricResultRepository struct {
	db *sqlx.DB
}

// NewCanaryMetricResultRepository creates a new metric result repository.
func NewCanaryMetricResultRepository(db *sqlx.DB) *CanaryMetricResultRepository {
	return &CanaryMetricResultRepository{db: db}
}

// Create inserts a new metric result.
func (r *CanaryMetricResultRepository) Create(ctx context.Context, m *models.CanaryMetricResult) error {
	query := `
		INSERT INTO canary_metric_results (id, run_id, metric_name, baseline_value, canary_value, mann_whitney_p, ks_statistic, cliff_delta, verdict, category)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		m.ID, m.RunID, m.MetricName, m.BaselineValue, m.CanaryValue,
		m.MannWhitneyP, m.KsStatistic, m.CliffDelta, m.Verdict, m.Category,
	).Scan(&m.ID)
}

// FindByRun retrieves all metric results for an analysis run.
func (r *CanaryMetricResultRepository) FindByRun(ctx context.Context, runID string) ([]models.CanaryMetricResult, error) {
	var results []models.CanaryMetricResult
	query := `SELECT * FROM canary_metric_results WHERE run_id = $1 ORDER BY category, metric_name`
	err := r.db.SelectContext(ctx, &results, query, runID)
	if err != nil {
		return nil, err
	}
	return results, nil
}

// ==================== CanaryMLResultRepository ====================

// CanaryMLResultRepository provides data access for ML prediction results.
type CanaryMLResultRepository struct {
	db *sqlx.DB
}

// NewCanaryMLResultRepository creates a new ML result repository.
func NewCanaryMLResultRepository(db *sqlx.DB) *CanaryMLResultRepository {
	return &CanaryMLResultRepository{db: db}
}

// Create inserts a new ML result.
func (r *CanaryMLResultRepository) Create(ctx context.Context, ml *models.CanaryMLResult) error {
	query := `
		INSERT INTO canary_ml_results (id, run_id, model_name, prediction, confidence, shap_explanation, cluster_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		ml.ID, ml.RunID, ml.ModelName, ml.Prediction, ml.Confidence,
		ml.ShapExplanation, ml.ClusterID,
	).Scan(&ml.ID)
}

// FindByRun retrieves all ML results for an analysis run.
func (r *CanaryMLResultRepository) FindByRun(ctx context.Context, runID string) ([]models.CanaryMLResult, error) {
	var results []models.CanaryMLResult
	query := `SELECT * FROM canary_ml_results WHERE run_id = $1 ORDER BY model_name`
	err := r.db.SelectContext(ctx, &results, query, runID)
	if err != nil {
		return nil, err
	}
	return results, nil
}

// ==================== CanaryAnalysisConfigRepository ====================

// CanaryAnalysisConfigRepository provides data access for analysis configurations.
type CanaryAnalysisConfigRepository struct {
	db *sqlx.DB
}

// NewCanaryAnalysisConfigRepository creates a new config repository.
func NewCanaryAnalysisConfigRepository(db *sqlx.DB) *CanaryAnalysisConfigRepository {
	return &CanaryAnalysisConfigRepository{db: db}
}

// Create inserts a new analysis config.
func (r *CanaryAnalysisConfigRepository) Create(ctx context.Context, c *models.CanaryAnalysisConfig) error {
	query := `
		INSERT INTO canary_analysis_configs
			(id, service_name, environment, analysis_interval_sec, max_rounds, warmup_period_sec,
			 promote_threshold, rollback_threshold, traffic_step, metric_weights, excluded_metrics, slo_metrics)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		c.ID, c.ServiceName, c.Environment, c.AnalysisIntervalSec, c.MaxRounds,
		c.WarmupPeriodSec, c.PromoteThreshold, c.RollbackThreshold, c.TrafficStep,
		c.MetricWeights, c.ExcludedMetrics, c.SloMetrics,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

// FindByID retrieves a config by ID.
func (r *CanaryAnalysisConfigRepository) FindByID(ctx context.Context, id string) (*models.CanaryAnalysisConfig, error) {
	var c models.CanaryAnalysisConfig
	query := `SELECT * FROM canary_analysis_configs WHERE id = $1`
	err := r.db.GetContext(ctx, &c, query, id)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	return &c, nil
}

// FindByServiceEnv retrieves a config by service name and environment.
func (r *CanaryAnalysisConfigRepository) FindByServiceEnv(ctx context.Context, serviceName, environment string) (*models.CanaryAnalysisConfig, error) {
	var c models.CanaryAnalysisConfig
	query := `SELECT * FROM canary_analysis_configs WHERE service_name = $1 AND environment = $2`
	err := r.db.GetContext(ctx, &c, query, serviceName, environment)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	return &c, nil
}

// FindAll retrieves all analysis configs.
func (r *CanaryAnalysisConfigRepository) FindAll(ctx context.Context) ([]models.CanaryAnalysisConfig, error) {
	var configs []models.CanaryAnalysisConfig
	query := `SELECT * FROM canary_analysis_configs ORDER BY service_name, environment`
	err := r.db.SelectContext(ctx, &configs, query)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

// UpdateConfig updates specific fields of an analysis config.
func (r *CanaryAnalysisConfigRepository) UpdateConfig(ctx context.Context, id string, updates *models.CanaryAnalysisConfigUpdateInput) (*models.CanaryAnalysisConfig, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if updates.AnalysisIntervalSec != nil {
		setClauses = append(setClauses, fmt.Sprintf("analysis_interval_sec = $%d", paramIdx))
		args = append(args, *updates.AnalysisIntervalSec)
		paramIdx++
	}
	if updates.MaxRounds != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_rounds = $%d", paramIdx))
		args = append(args, *updates.MaxRounds)
		paramIdx++
	}
	if updates.WarmupPeriodSec != nil {
		setClauses = append(setClauses, fmt.Sprintf("warmup_period_sec = $%d", paramIdx))
		args = append(args, *updates.WarmupPeriodSec)
		paramIdx++
	}
	if updates.PromoteThreshold != nil {
		setClauses = append(setClauses, fmt.Sprintf("promote_threshold = $%d", paramIdx))
		args = append(args, *updates.PromoteThreshold)
		paramIdx++
	}
	if updates.RollbackThreshold != nil {
		setClauses = append(setClauses, fmt.Sprintf("rollback_threshold = $%d", paramIdx))
		args = append(args, *updates.RollbackThreshold)
		paramIdx++
	}
	if updates.TrafficStep != nil {
		setClauses = append(setClauses, fmt.Sprintf("traffic_step = $%d", paramIdx))
		args = append(args, *updates.TrafficStep)
		paramIdx++
	}
	if updates.MetricWeights != nil {
		setClauses = append(setClauses, fmt.Sprintf("metric_weights = $%d", paramIdx))
		args = append(args, updates.MetricWeights)
		paramIdx++
	}
	if updates.ExcludedMetrics != nil {
		setClauses = append(setClauses, fmt.Sprintf("excluded_metrics = $%d", paramIdx))
		args = append(args, models.StringArray(updates.ExcludedMetrics))
		paramIdx++
	}
	if updates.SloMetrics != nil {
		setClauses = append(setClauses, fmt.Sprintf("slo_metrics = $%d", paramIdx))
		args = append(args, models.StringArray(updates.SloMetrics))
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE canary_analysis_configs SET %s WHERE id = $%d RETURNING *",
		strings.Join(setClauses, ", "), paramIdx)

	var c models.CanaryAnalysisConfig
	err := r.db.GetContext(ctx, &c, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}
	return &c, nil
}

// Delete removes an analysis config by ID.
func (r *CanaryAnalysisConfigRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM canary_analysis_configs WHERE id = $1`, id)
	return err
}

// ==================== CanaryDecisionRepository ====================

// CanaryDecisionRepository provides data access for decision records.
type CanaryDecisionRepository struct {
	db *sqlx.DB
}

// NewCanaryDecisionRepository creates a new decision repository.
func NewCanaryDecisionRepository(db *sqlx.DB) *CanaryDecisionRepository {
	return &CanaryDecisionRepository{db: db}
}

// Create inserts a new decision record.
func (r *CanaryDecisionRepository) Create(ctx context.Context, d *models.CanaryDecisionRecord) error {
	query := `
		INSERT INTO canary_decisions (id, run_id, decision, reason, overridden_by, override_reason, decided_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		d.ID, d.RunID, d.Decision, d.Reason, d.OverriddenBy, d.OverrideReason, d.DecidedAt,
	).Scan(&d.ID)
}

// FindByRun retrieves all decision records for an analysis run.
func (r *CanaryDecisionRepository) FindByRun(ctx context.Context, runID string) ([]models.CanaryDecisionRecord, error) {
	var decisions []models.CanaryDecisionRecord
	query := `SELECT * FROM canary_decisions WHERE run_id = $1 ORDER BY decided_at`
	err := r.db.SelectContext(ctx, &decisions, query, runID)
	if err != nil {
		return nil, err
	}
	return decisions, nil
}

// ==================== CanaryRetrainJobRepository ====================

// CanaryRetrainJobRepository provides data access for ML retrain jobs.
type CanaryRetrainJobRepository struct {
	db *sqlx.DB
}

// NewCanaryRetrainJobRepository creates a new retrain job repository.
func NewCanaryRetrainJobRepository(db *sqlx.DB) *CanaryRetrainJobRepository {
	return &CanaryRetrainJobRepository{db: db}
}

// CreateJob inserts a new retrain job.
func (r *CanaryRetrainJobRepository) CreateJob(ctx context.Context, job *models.CanaryRetrainJob) error {
	query := `
		INSERT INTO canary_retrain_jobs (id, model_name, status)
		VALUES ($1, $2, $3)
		RETURNING id, submitted_at, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		job.ID, job.ModelName, job.Status,
	).Scan(&job.ID, &job.SubmittedAt, &job.CreatedAt)
}

// FindAll retrieves all retrain jobs ordered by submission time.
func (r *CanaryRetrainJobRepository) FindAll(ctx context.Context) ([]models.CanaryRetrainJob, error) {
	var jobs []models.CanaryRetrainJob
	query := `SELECT * FROM canary_retrain_jobs ORDER BY submitted_at DESC`
	err := r.db.SelectContext(ctx, &jobs, query)
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

// UpdateStatus updates the status and optionally the error message of a retrain job.
func (r *CanaryRetrainJobRepository) UpdateStatus(ctx context.Context, id, status string, errorMessage *string) (*models.CanaryRetrainJob, error) {
	query := `
		UPDATE canary_retrain_jobs
		SET status = $2, error_message = $3,
		    completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
		WHERE id = $1
		RETURNING *
	`
	var job models.CanaryRetrainJob
	err := r.db.GetContext(ctx, &job, query, id, status, errorMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to update retrain job: %w", err)
	}
	return &job, nil
}

// ==================== TrafficConfigRepository ====================

// TrafficConfigRepository provides data access for traffic split configurations.
type TrafficConfigRepository struct {
	db *sqlx.DB
}

// NewTrafficConfigRepository creates a new traffic config repository.
func NewTrafficConfigRepository(db *sqlx.DB) *TrafficConfigRepository {
	return &TrafficConfigRepository{db: db}
}

// UpsertConfig inserts or updates a traffic config.
func (r *TrafficConfigRepository) UpsertConfig(ctx context.Context, input *models.TrafficConfigUpsertInput) (*models.TrafficConfig, error) {
	query := `
		INSERT INTO canary_traffic_configs
			(id, canary_id, strategy, host, namespace, upstream_name, phase,
			 baseline_weight, canary_weight, baseline_destination, baseline_subset,
			 canary_destination, canary_subset, servers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (id) DO UPDATE SET
			strategy = EXCLUDED.strategy,
			host = EXCLUDED.host,
			namespace = EXCLUDED.namespace,
			upstream_name = EXCLUDED.upstream_name,
			phase = EXCLUDED.phase,
			baseline_weight = EXCLUDED.baseline_weight,
			canary_weight = EXCLUDED.canary_weight,
			baseline_destination = EXCLUDED.baseline_destination,
			baseline_subset = EXCLUDED.baseline_subset,
			canary_destination = EXCLUDED.canary_destination,
			canary_subset = EXCLUDED.canary_subset,
			servers = EXCLUDED.servers,
			updated_at = NOW()
		RETURNING *
	`
	serversJSON, err := json.Marshal(input.Servers)
	if err != nil {
		serversJSON = []byte("[]")
	}

	var config models.TrafficConfig
	err = r.db.GetContext(ctx, &config, query,
		input.ID, input.CanaryID, input.Strategy,
		input.Host, input.Namespace, input.UpstreamName, input.Phase,
		input.BaselineWeight, input.CanaryWeight,
		input.BaselineDestination, input.BaselineSubset,
		input.CanaryDestination, input.CanarySubset,
		string(serversJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert traffic config: %w", err)
	}
	return &config, nil
}

// FindByCanaryID retrieves the latest traffic config for a canary.
func (r *TrafficConfigRepository) FindByCanaryID(ctx context.Context, canaryID string) (*models.TrafficConfig, error) {
	var config models.TrafficConfig
	query := `SELECT * FROM canary_traffic_configs WHERE canary_id = $1 ORDER BY updated_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &config, query, canaryID)
	if err != nil {
		return nil, fmt.Errorf("traffic config not found: %w", err)
	}
	return &config, nil
}

// FindAll retrieves all traffic configs.
func (r *TrafficConfigRepository) FindAll(ctx context.Context) ([]models.TrafficConfig, error) {
	var configs []models.TrafficConfig
	query := `SELECT * FROM canary_traffic_configs ORDER BY updated_at DESC`
	err := r.db.SelectContext(ctx, &configs, query)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

// Update updates specific fields of a traffic config by canary ID.
func (r *TrafficConfigRepository) Update(ctx context.Context, canaryID string, updates *models.TrafficConfigUpdateInput) (*models.TrafficConfig, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if updates.Strategy != nil {
		setClauses = append(setClauses, fmt.Sprintf("strategy = $%d", paramIdx))
		args = append(args, *updates.Strategy)
		paramIdx++
	}
	if updates.BaselineWeight != nil {
		setClauses = append(setClauses, fmt.Sprintf("baseline_weight = $%d", paramIdx))
		args = append(args, *updates.BaselineWeight)
		paramIdx++
	}
	if updates.CanaryWeight != nil {
		setClauses = append(setClauses, fmt.Sprintf("canary_weight = $%d", paramIdx))
		args = append(args, *updates.CanaryWeight)
		paramIdx++
	}
	if updates.BaselineDestination != nil {
		setClauses = append(setClauses, fmt.Sprintf("baseline_destination = $%d", paramIdx))
		args = append(args, *updates.BaselineDestination)
		paramIdx++
	}
	if updates.CanaryDestination != nil {
		setClauses = append(setClauses, fmt.Sprintf("canary_destination = $%d", paramIdx))
		args = append(args, *updates.CanaryDestination)
		paramIdx++
	}
	if updates.Host != nil {
		setClauses = append(setClauses, fmt.Sprintf("host = $%d", paramIdx))
		args = append(args, *updates.Host)
		paramIdx++
	}
	if updates.Namespace != nil {
		setClauses = append(setClauses, fmt.Sprintf("namespace = $%d", paramIdx))
		args = append(args, *updates.Namespace)
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.FindByCanaryID(ctx, canaryID)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, canaryID)
	query := fmt.Sprintf(
		"UPDATE canary_traffic_configs SET %s WHERE canary_id = $%d RETURNING *",
		strings.Join(setClauses, ", "), paramIdx,
	)

	var config models.TrafficConfig
	err := r.db.GetContext(ctx, &config, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update traffic config: %w", err)
	}
	return &config, nil
}

// Delete removes a traffic config by canary ID.
func (r *TrafficConfigRepository) Delete(ctx context.Context, canaryID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM canary_traffic_configs WHERE canary_id = $1`, canaryID)
	return err
}

// ==================== TrafficHistoryRepository ====================

// TrafficHistoryRepository provides data access for traffic execution history.
type TrafficHistoryRepository struct {
	db *sqlx.DB
}

// NewTrafficHistoryRepository creates a new traffic history repository.
func NewTrafficHistoryRepository(db *sqlx.DB) *TrafficHistoryRepository {
	return &TrafficHistoryRepository{db: db}
}

// CreateEntry inserts a new traffic execution history entry.
func (r *TrafficHistoryRepository) CreateEntry(ctx context.Context, input *models.TrafficHistoryCreateInput) (*models.TrafficHistory, error) {
	query := `
		INSERT INTO canary_traffic_history (id, canary_id, success, result, error)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	`
	var history models.TrafficHistory
	err := r.db.GetContext(ctx, &history, query,
		input.ID, input.CanaryID, input.Success, input.Result, input.Error,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create traffic history: %w", err)
	}
	return &history, nil
}

// FindByCanaryID retrieves all history entries for a canary.
func (r *TrafficHistoryRepository) FindByCanaryID(ctx context.Context, canaryID string) ([]models.TrafficHistory, error) {
	var history []models.TrafficHistory
	query := `SELECT * FROM canary_traffic_history WHERE canary_id = $1 ORDER BY executed_at DESC`
	err := r.db.SelectContext(ctx, &history, query, canaryID)
	if err != nil {
		return nil, err
	}
	return history, nil
}

// FindAll retrieves all history entries.
func (r *TrafficHistoryRepository) FindAll(ctx context.Context) ([]models.TrafficHistory, error) {
	var history []models.TrafficHistory
	query := `SELECT * FROM canary_traffic_history ORDER BY executed_at DESC`
	err := r.db.SelectContext(ctx, &history, query)
	if err != nil {
		return nil, err
	}
	return history, nil
}
