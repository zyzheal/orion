package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/deployment-trigger/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = errors.New("deployment trigger not found")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) initTable() error {
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS deployment_triggers (
			id VARCHAR(36) PRIMARY KEY,
			tenant_id VARCHAR(36) NOT NULL,
			name VARCHAR(255) NOT NULL,
			trigger_type VARCHAR(64) NOT NULL,
			expression VARCHAR(512),
			target_pipeline VARCHAR(255) NOT NULL,
			status VARCHAR(32) NOT NULL,
			last_triggered_at TIMESTAMP WITH TIME ZONE,
			last_trigger_id VARCHAR(36),
			enabled BOOLEAN NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL
		)`)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS trigger_executions (
			id VARCHAR(36) PRIMARY KEY,
			trigger_id VARCHAR(36) NOT NULL,
			tenant_id VARCHAR(36) NOT NULL,
			triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
			status VARCHAR(32) NOT NULL,
			pipeline_run_id VARCHAR(36),
			"error" TEXT,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL
		)`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.DeploymentTrigger, error) {
	if err := r.initTable(); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	trg := &models.DeploymentTrigger{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Name:           req.Name,
		TriggerType:    req.TriggerType,
		Expression:     req.Expression,
		TargetPipeline: req.TargetPipeline,
		Status:         models.TriggerStatusActive,
		Enabled:        req.Enabled != nil && *req.Enabled,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO deployment_triggers
			(id, tenant_id, name, trigger_type, expression, target_pipeline, status, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :trigger_type, :expression, :target_pipeline, :status, :enabled, :created_at, :updated_at)`, trg)
	if err != nil {
		return nil, err
	}
	return trg, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.DeploymentTrigger, error) {
	var e models.DeploymentTrigger
	err := r.db.GetContext(ctx, &e,
		"SELECT * FROM deployment_triggers WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.DeploymentTrigger, error) {
	var entities []models.DeploymentTrigger
	err := r.db.SelectContext(ctx, &entities,
		"SELECT * FROM deployment_triggers WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.DeploymentTrigger, error) {
	_, err := r.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{id, tenantID}
	if req.Name != nil {
		sets = append(sets, "name = $"+strconv.Itoa(len(args)+1))
		args = append(args, *req.Name)
	}
	if req.TriggerType != nil {
		sets = append(sets, "trigger_type = $"+strconv.Itoa(len(args)+1))
		args = append(args, string(*req.TriggerType))
	}
	if req.Expression != nil {
		sets = append(sets, "expression = $"+strconv.Itoa(len(args)+1))
		args = append(args, *req.Expression)
	}
	if req.TargetPipeline != nil {
		sets = append(sets, "target_pipeline = $"+strconv.Itoa(len(args)+1))
		args = append(args, *req.TargetPipeline)
	}
	if req.Status != nil {
		sets = append(sets, "status = $"+strconv.Itoa(len(args)+1))
		args = append(args, string(*req.Status))
	}
	if req.Enabled != nil {
		sets = append(sets, "enabled = $"+strconv.Itoa(len(args)+1))
		args = append(args, *req.Enabled)
	}
	if len(sets) == 1 {
		return r.GetByID(ctx, tenantID, id)
	}
	_, err = r.db.ExecContext(ctx, "UPDATE deployment_triggers SET "+joinComma(sets)+
		" WHERE id = $"+strconv.Itoa(len(args)-1)+" AND tenant_id = $"+strconv.Itoa(len(args)), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM trigger_executions WHERE trigger_id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		"DELETE FROM deployment_triggers WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}

func (r *Repository) CreateExecution(ctx context.Context, ex *models.TriggerExecution) error {
	ex.ID = uuid.New().String()
	ex.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO trigger_executions
			(id, trigger_id, tenant_id, triggered_at, status, pipeline_run_id, error, created_at)
		VALUES (:id, :trigger_id, :tenant_id, :triggered_at, :status, :pipeline_run_id, :error, :created_at)`, ex)
	return err
}

func (r *Repository) GetExecutions(ctx context.Context, triggerID, tenantID string, limit int) ([]models.TriggerExecution, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var executions []models.TriggerExecution
	err := r.db.SelectContext(ctx, &executions,
		"SELECT * FROM trigger_executions WHERE trigger_id = $1 AND tenant_id = $2 ORDER BY triggered_at DESC LIMIT $3",
		triggerID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	return executions, nil
}

func (r *Repository) GetLatestExecution(ctx context.Context, triggerID, tenantID string) (*models.TriggerExecution, error) {
	var ex models.TriggerExecution
	err := r.db.GetContext(ctx, &ex,
		"SELECT * FROM trigger_executions WHERE trigger_id = $1 AND tenant_id = $2 ORDER BY triggered_at DESC LIMIT 1",
		triggerID, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &ex, nil
}

func joinComma(ss []string) string {
	out := ""
	for i, s := range ss {
		if i > 0 {
			out += ", "
		}
		out += s
	}
	return out
}