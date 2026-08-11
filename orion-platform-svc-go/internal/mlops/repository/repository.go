package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/mlops/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed data access for the MLOps module.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Model Registry ====================

func (r *Repository) ListModels(ctx context.Context, tenantID string) ([]models.Model, error) {
	var items []models.Model
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_models WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetModel(ctx context.Context, tenantID, id string) (*models.Model, error) {
	var m models.Model
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM mlops_models WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) CreateModel(ctx context.Context, tenantID string, req models.CreateModelRequest) (*models.Model, error) {
	m := &models.Model{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		Framework:     req.Framework,
		Version:       req.Version,
		Description:   req.Description,
		Status:        "draft",
		ArtifactPath:  req.ArtifactPath,
		Metadata:      req.Metadata,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	if m.Framework == "" {
		m.Framework = "unknown"
	}
	if m.Version == "" {
		m.Version = "v1.0.0"
	}

	configJSON, _ := json.Marshal(m.Metadata)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO mlops_models (id, tenant_id, name, framework, version, description, status, artifact_path, metadata, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :framework, :version, :description, :status, :artifact_path, :metadata, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":           m.ID,
			"tenant_id":    tenantID,
			"name":         m.Name,
			"framework":    m.Framework,
			"version":      m.Version,
			"description":  m.Description,
			"status":       m.Status,
			"artifact_path": m.ArtifactPath,
			"metadata":     string(configJSON),
			"created_at":   m.CreatedAt,
			"updated_at":   m.UpdatedAt,
		})
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *Repository) UpdateModel(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Model, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()

	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for k, v := range updates {
		if k == "metadata" {
			if b, err := json.Marshal(v); err == nil {
				v = string(b)
			}
		}
		setClauses = append(setClauses, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)

	query := fmt.Sprintf(`UPDATE mlops_models SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetModel(ctx, tenantID, id)
}

func (r *Repository) DeleteModel(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE mlops_models SET status='archived' WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) DeregisterModel(ctx context.Context, tenantID, id string) error {
	return r.DeleteModel(ctx, tenantID, id)
}

// ==================== Training Jobs ====================

func (r *Repository) CreateTrainingJob(ctx context.Context, tenantID, modelID string, req models.TrainingJobRequest) (*models.TrainingJob, error) {
	now := time.Now().UTC()
	job := &models.TrainingJob{
		ID:        uuid.New().String(),
		ModelID:   modelID,
		TenantID:  tenantID,
		Name:      req.Name,
		Status:    "pending",
		Config:    req.Config,
		StartedAt: &now,
		CreatedAt: now,
	}
	configJSON, _ := json.Marshal(req.Config)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_training_jobs (id, model_id, tenant_id, name, status, config, started_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		job.ID, modelID, tenantID, job.Name, job.Status, string(configJSON), job.StartedAt, job.CreatedAt)
	if err != nil {
		return nil, err
	}
	return job, nil
}

func (r *Repository) UpdateTrainingJobStatus(ctx context.Context, id string, status string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE mlops_training_jobs SET status=$1, completed_at=$2 WHERE id=$3`,
		status, now, id)
	return err
}

func (r *Repository) ListTrainingJobsByModel(ctx context.Context, modelID string) ([]models.TrainingJob, error) {
	var items []models.TrainingJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_training_jobs WHERE model_id=$1 ORDER BY created_at DESC`, modelID)
	return items, err
}

// ==================== Experiments ====================

func (r *Repository) CreateExperiment(ctx context.Context, tenantID, modelID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
	now := time.Now().UTC()
	exp := &models.Experiment{
		ID:          uuid.New().String(),
		ModelID:     modelID,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Status:      "running",
		Config:      req.Config,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	configJSON, _ := json.Marshal(req.Config)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_experiments (id, model_id, tenant_id, name, description, status, config, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		exp.ID, modelID, tenantID, exp.Name, exp.Description, exp.Status, string(configJSON), exp.CreatedAt, exp.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return exp, nil
}

func (r *Repository) ListExperimentsByModel(ctx context.Context, modelID string) ([]models.Experiment, error) {
	var items []models.Experiment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_experiments WHERE model_id=$1 ORDER BY created_at DESC`, modelID)
	return items, err
}

func (r *Repository) SaveExperimentResults(ctx context.Context, id string, results map[string]interface{}) error {
	resultsJSON, _ := json.Marshal(results)
	_, err := r.db.ExecContext(ctx,
		`UPDATE mlops_experiments SET results=$1, updated_at=$2 WHERE id=$3`,
		string(resultsJSON), time.Now().UTC(), id)
	return err
}

// ==================== Artifacts ====================

func (r *Repository) CreateArtifact(ctx context.Context, tenantID, modelID string, req models.CreateArtifactRequest) (*models.Artifact, error) {
	now := time.Now().UTC()
	art := &models.Artifact{
		ID:         uuid.New().String(),
		ModelID:    modelID,
		TenantID:   tenantID,
		Name:       req.Name,
		Type:       req.Type,
		StoragePath: req.StoragePath,
		SizeBytes:  req.SizeBytes,
		Checksum:   req.Checksum,
		Metadata:   req.Metadata,
		CreatedAt:  now,
	}
	if art.Type == "" {
		art.Type = "checkpoint"
	}
	metadataJSON, _ := json.Marshal(art.Metadata)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_artifacts (id, model_id, tenant_id, name, type, storage_path, size_bytes, checksum, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		art.ID, modelID, tenantID, art.Name, art.Type, art.StoragePath, art.SizeBytes, art.Checksum, string(metadataJSON), art.CreatedAt)
	if err != nil {
		return nil, err
	}
	return art, nil
}

func (r *Repository) ListArtifactsByModel(ctx context.Context, modelID string) ([]models.Artifact, error) {
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_artifacts WHERE model_id=$1 ORDER BY created_at DESC`, modelID)
	return items, err
}

// ==================== Deployments ====================

func (r *Repository) CreateDeployment(ctx context.Context, tenantID, modelID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	now := time.Now().UTC()
	dep := &models.Deployment{
		ID:          uuid.New().String(),
		ModelID:     modelID,
		TenantID:    tenantID,
		Environment: req.Environment,
		Status:      "pending",
		EndpointURL: req.EndpointURL,
		Config:      req.Config,
		CreatedAt:   now,
	}
	if dep.Environment == "" {
		dep.Environment = "staging"
	}
	configJSON, _ := json.Marshal(dep.Config)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_deployments (id, model_id, tenant_id, environment, status, endpoint_url, config, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		dep.ID, modelID, tenantID, dep.Environment, dep.Status, dep.EndpointURL, string(configJSON), dep.CreatedAt)
	if err != nil {
		return nil, err
	}
	return dep, nil
}

func (r *Repository) UpdateDeploymentStatus(ctx context.Context, id string, status string, endpointURL string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE mlops_deployments SET status=$1, endpoint_url=$2, deployed_at=$3 WHERE id=$4`,
		status, endpointURL, now, id)
	return err
}

func (r *Repository) RollbackDeployment(ctx context.Context, tenantID, modelID string, req models.RollbackRequest) (*models.Deployment, error) {
	now := time.Now().UTC()
	dep := &models.Deployment{
		ID:          uuid.New().String(),
		ModelID:     modelID,
		TenantID:    tenantID,
		Environment: req.Environment,
		Status:      "rolling_back",
		Config:      req.Config,
		CreatedAt:   now,
	}
	if dep.Environment == "" {
		dep.Environment = "staging"
	}
	configJSON, _ := json.Marshal(dep.Config)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_deployments (id, model_id, tenant_id, environment, status, config, rollback_of, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		dep.ID, modelID, tenantID, dep.Environment, dep.Status, string(configJSON), req.RollbackOf, dep.CreatedAt)
	if err != nil {
		return nil, err
	}
	return dep, nil
}

func (r *Repository) GetLatestDeployment(ctx context.Context, tenantID, modelID string) (*models.Deployment, error) {
	var dep models.Deployment
	err := r.db.GetContext(ctx, &dep,
		`SELECT * FROM mlops_deployments WHERE model_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`,
		modelID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &dep, err
}

// ==================== Pipelines ====================

func (r *Repository) ListPipelines(ctx context.Context, tenantID string) ([]models.Pipeline, error) {
	var items []models.Pipeline
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_pipelines WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// ==================== Metrics ====================

func (r *Repository) RecordMetric(ctx context.Context, tenantID, modelID string, req models.RecordMetricRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mlops_metrics (id, model_id, tenant_id, metric_name, metric_value, unit, timestamp, tags)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		uuid.New().String(), modelID, tenantID, req.MetricName, req.MetricValue, req.Unit, time.Now().UTC(), "{}")
	return err
}

func (r *Repository) GetModelMetrics(ctx context.Context, modelID string, limit int) ([]models.Metric, error) {
	if limit <= 0 {
		limit = 100
	}
	var items []models.Metric
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM mlops_metrics WHERE model_id=$1 ORDER BY timestamp DESC LIMIT $2`, modelID, limit)
	return items, err
}

// ==================== Stats ====================

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.MLOpsStats, error) {
	stats := &models.MLOpsStats{}

	r.db.GetContext(ctx, &stats.TotalModels,
		`SELECT COUNT(*) FROM mlops_models WHERE tenant_id=$1`, tenantID)
	r.db.GetContext(ctx, &stats.ActiveDeployments,
		`SELECT COUNT(*) FROM mlops_deployments WHERE tenant_id=$1 AND status='active'`, tenantID)
	r.db.GetContext(ctx, &stats.RunningJobs,
		`SELECT COUNT(*) FROM mlops_training_jobs WHERE tenant_id=$1 AND status='running'`, tenantID)
	r.db.GetContext(ctx, &stats.CompletedExperiments,
		`SELECT COUNT(*) FROM mlops_experiments WHERE tenant_id=$1 AND status='completed'`, tenantID)

	return stats, nil
}

// Legacy compatibility: satisfy shared CRUD interface (unused by MLOps handler).
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	modelsList, err := r.ListModels(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var records []models.Record
	for _, m := range modelsList {
		records = append(records, models.Record{
			ID:        m.ID,
			TenantID:  m.TenantID,
			Name:      m.Name,
			Status:    m.Status,
			CreatedAt: m.CreatedAt,
		})
	}
	return records, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	m, err := r.GetModel(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &models.Record{
		ID:        m.ID,
		TenantID:  m.TenantID,
		Name:      m.Name,
		Status:    m.Status,
		CreatedAt: m.CreatedAt,
	}, nil
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	m, err := r.CreateModel(ctx, tenantID, models.CreateModelRequest{
		Name:      req.Name,
		Metadata:  req.Config,
		Framework: "unknown",
		Version:   "v1.0.0",
	})
	if err != nil {
		return nil, err
	}
	return &models.Record{ID: m.ID, TenantID: m.TenantID, Name: m.Name, Status: m.Status, CreatedAt: m.CreatedAt}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	m, err := r.UpdateModel(ctx, tenantID, id, map[string]interface{}{"name": req.Name})
	if err != nil {
		return nil, err
	}
	return &models.Record{ID: m.ID, TenantID: m.TenantID, Name: m.Name, Status: m.Status, CreatedAt: m.CreatedAt}, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	return r.DeleteModel(ctx, tenantID, id)
}