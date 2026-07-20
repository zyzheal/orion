package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline/models"

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

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.Pipeline, error) {
	spec := "{}"
	if req.YamlDefinition != "" {
		spec = fmt.Sprintf(`{"yaml": %s}`, stringToJSON(req.YamlDefinition))
	}
	config := "{}"

	p := &models.Pipeline{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		ProjectID:      req.ProjectID,
		Name:           req.Name,
		Description:    req.Description,
		TriggerType:    models.PipelineTriggerType(req.TriggerType),
		Status:         models.PipelineStatusActive,
		Version:        req.Version,
		YamlDefinition: req.YamlDefinition,
		Spec:           spec,
		Config:         config,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if p.TriggerType == "" {
		p.TriggerType = models.TriggerTypeManual
	}
	if p.Version == 0 {
		p.Version = 1
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO pipelines (id, tenant_id, project_id, name, description, trigger_type, status, version, yaml_definition, spec, config, created_at, updated_at)
		VALUES (:id, :tenantId, :projectId, :name, :description, :triggerType, :status, :version, :yamlDefinition, :spec, :config, :createdAt, :updatedAt)
	`, p)
	return p, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	var p models.Pipeline
	err := r.db.GetContext(ctx, &p, `SELECT * FROM pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, opt models.ListPipelinesOptions) ([]models.Pipeline, int, error) {
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
	if opt.Name != "" {
		whereParts = append(whereParts, fmt.Sprintf("LOWER(name) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(opt.Name)+"%")
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")
	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM pipelines WHERE "+whereClause, args...); err != nil {
		return nil, 0, err
	}

	dataSQL := fmt.Sprintf("SELECT * FROM pipelines WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)
	var items []models.Pipeline
	if err := r.db.SelectContext(ctx, &items, dataSQL, args...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.UpdatePipelineRequest) (*models.Pipeline, error) {
	updates := make(map[string]interface{})
	updates["updated_at"] = time.Now().UTC()
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.YamlDefinition != nil {
		updates["yaml_definition"] = *req.YamlDefinition
	}
	if req.Status != nil {
		updates["status"] = *req.Status
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

	query := "UPDATE pipelines SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " AND tenant_id = $" + fmt.Sprint(idx+1) + " RETURNING *"
	var p models.Pipeline
	err := r.db.GetContext(ctx, &p, query, args...)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) GetVersions(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineVersion, error) {
	var versions []models.PipelineVersion
	err := r.db.SelectContext(ctx, &versions, `
		SELECT id, name, version, description, status, created_at FROM pipelines WHERE id=$1 AND tenant_id=$2 ORDER BY version DESC
	`, pipelineID, tenantID)
	return versions, err
}

func (r *Repository) GetStats(ctx context.Context, tenantID, pipelineID string) (*models.PipelineStats, error) {
	var stats models.PipelineStats
	err := r.db.GetContext(ctx, &stats, `
		SELECT
			COUNT(*) as totalRuns,
			SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successRuns,
			SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failedRuns,
			SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as runningRuns,
			COALESCE(AVG(duration_ms), 0) as avgDuration
		FROM pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2
	`, tenantID, pipelineID)
	return &stats, err
}

func stringToJSON(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}
