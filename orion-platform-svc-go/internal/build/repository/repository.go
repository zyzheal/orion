package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/build/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func nowUnix() *int64 {
	t := time.Now().Unix()
	return &t
}

// === Builds ===

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	buildArgsJSON := "{}"
	if len(req.BuildArgs) > 0 {
		b, err := json.Marshal(req.BuildArgs)
		if err != nil {
			return nil, err
		}
		buildArgsJSON = string(b)
	}

	b := &models.Build{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ProjectID:     req.ProjectID,
		PipelineRunID: req.PipelineRunID,
		SourceRef:     req.SourceRef,
		Status:        models.BuildStatusPending,
		BuildArgs:     buildArgsJSON,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO builds (id, tenant_id, project_id, pipeline_run_id, source_ref, status, build_args, created_at, updated_at)
		VALUES (:id, :tenantId, :projectId, :pipelineRunId, :sourceRef, :status, :buildArgs, :createdAt, :updatedAt)
	`, b)
	return b, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var b models.Build
	err := r.db.GetContext(ctx, &b, `SELECT * FROM builds WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, opt models.ListBuildsOptions) ([]models.Build, int, error) {
	limit := opt.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (opt.Page - 1) * limit
	if opt.Page <= 0 {
		opt.Page = 1
		offset = 0
	}

	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if opt.ProjectID != "" {
		whereParts = append(whereParts, fmt.Sprintf("project_id = $%d", argIdx))
		args = append(args, opt.ProjectID)
		argIdx++
	}
	if opt.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, opt.Status)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM builds WHERE "+whereClause, args...); err != nil {
		return nil, 0, err
	}

	dataSQL := fmt.Sprintf("SELECT * FROM builds WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var builds []models.Build
	if err := r.db.SelectContext(ctx, &builds, dataSQL, args...); err != nil {
		return nil, 0, err
	}
	return builds, total, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status models.BuildStatus, updates map[string]interface{}) (*models.Build, error) {
	updates["status"] = string(status)
	updates["updated_at"] = time.Now().UTC()

	if status == models.BuildStatusRunning {
		now := time.Now().UTC()
		updates["started_at"] = &now
	} else if status == models.BuildStatusSuccess || status == models.BuildStatusFailed || status == models.BuildStatusCancelled {
		now := time.Now().UTC()
		updates["completed_at"] = &now
	}

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)

	query := "UPDATE builds SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " AND tenant_id = $" + fmt.Sprint(idx+1) + " RETURNING *"
	var b models.Build
	err := r.db.GetContext(ctx, &b, query, args...)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return r.UpdateStatus(ctx, tenantID, id, models.BuildStatusRunning, map[string]interface{}{})
}

func (r *Repository) CompleteBuild(ctx context.Context, tenantID, id string, status models.BuildStatus, errMsg string) (*models.Build, error) {
	updates := map[string]interface{}{}
	if errMsg != "" {
		updates["error"] = errMsg
	}
	return r.UpdateStatus(ctx, tenantID, id, status, updates)
}

func (r *Repository) GetByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error) {
	var b models.Build
	err := r.db.GetContext(ctx, &b, `SELECT * FROM builds WHERE tenant_id=$1 AND pipeline_run_id=$2 ORDER BY created_at DESC LIMIT 1`, tenantID, pipelineRunID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error) {
	var stats models.BuildStats
	err := r.db.GetContext(ctx, &stats, `
		SELECT
			COUNT(*) as total,
			SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
			SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
			SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running,
			SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
			COALESCE(AVG(duration), 0) as avgDuration
		FROM builds WHERE tenant_id=$1
	`, tenantID)
	return &stats, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM builds WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// === Build Environments ===

func (r *Repository) CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) (*models.BuildEnvironment, error) {
	configJSON := "{}"
	if len(req.Config) > 0 {
		b, err := json.Marshal(req.Config)
		if err != nil {
			return nil, err
		}
		configJSON = string(b)
	}

	env := &models.BuildEnvironment{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Image:       req.Image,
		Description: req.Description,
		Config:      configJSON,
		Enabled:     true,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO build_environments (id, tenant_id, name, image, description, config, enabled, created_at, updated_at)
		VALUES (:id, :tenantId, :name, :image, :description, :config, :enabled, :createdAt, :updatedAt)
	`, env)
	return env, err
}

func (r *Repository) GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error) {
	var env models.BuildEnvironment
	err := r.db.GetContext(ctx, &env, `SELECT * FROM build_environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &env, nil
}

func (r *Repository) ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error) {
	var envs []models.BuildEnvironment
	err := r.db.SelectContext(ctx, &envs, `SELECT * FROM build_environments WHERE tenant_id=$1 ORDER BY name`, tenantID)
	return envs, err
}

func (r *Repository) UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) (*models.BuildEnvironment, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Image != nil {
		updates["image"] = *req.Image
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Config != nil {
		b, err := json.Marshal(req.Config)
		if err != nil {
			return nil, err
		}
		updates["config"] = string(b)
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	updates["updated_at"] = time.Now().UTC()

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)

	query := "UPDATE build_environments SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " AND tenant_id = $" + fmt.Sprint(idx+1) + " RETURNING *"
	var env models.BuildEnvironment
	err := r.db.GetContext(ctx, &env, query, args...)
	if err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *Repository) DeleteEnvironment(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM build_environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
