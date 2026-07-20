package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/runbook/models"

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

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS runbooks (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		title VARCHAR(255) NOT NULL,
		description TEXT DEFAULT '',
		category VARCHAR(64) DEFAULT '',
		severity VARCHAR(32) DEFAULT 'medium',
		steps JSONB DEFAULT '[]',
		tags JSONB DEFAULT '[]',
		owner VARCHAR(128) DEFAULT '',
		approved BOOLEAN DEFAULT FALSE,
		enabled BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_runbooks_tenant ON runbooks(tenant_id);
	CREATE TABLE IF NOT EXISTS runbook_executions (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		runbook_id UUID NOT NULL,
		incident_id UUID,
		executor_id VARCHAR(128) DEFAULT '',
		status VARCHAR(32) DEFAULT 'pending',
		started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		completed_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_runbook_executions_tenant ON runbook_executions(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id);
	CREATE TABLE IF NOT EXISTS runbook_execution_steps (
		id UUID PRIMARY KEY,
		execution_id UUID NOT NULL,
		step_order INTEGER NOT NULL,
		status VARCHAR(32) DEFAULT 'pending',
		output TEXT DEFAULT '',
		started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		completed_at TIMESTAMP WITH TIME ZONE,
		UNIQUE(execution_id, step_order)
	);
	`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.Runbook) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	if m.Steps == nil {
		m.Steps = []models.RunbookStep{}
	}
	if m.Tags == nil {
		m.Tags = []string{}
	}
	steps, _ := json.Marshal(m.Steps)
	tags, _ := json.Marshal(m.Tags)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO runbooks (id, tenant_id, title, description, category, severity, steps, tags, owner, approved, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :title, :description, :category, :severity, :steps, :tags, :owner, :approved, :enabled, :created_at, :updated_at)`,
		map[string]interface{}{
			"id": m.ID, "tenant_id": m.TenantID,
			"title": m.Title, "description": m.Description,
			"category": m.Category, "severity": m.Severity,
			"steps": string(steps), "tags": string(tags),
			"owner": m.Owner, "approved": m.Approved,
			"enabled": m.Enabled, "created_at": m.CreatedAt,
			"updated_at": m.UpdatedAt,
		})
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Runbook, error) {
	var m models.Runbook
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM runbooks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Runbook, int, error) {
	cond := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if q.Category != "" {
		cond += " AND category = $" + strconv.Itoa(idx)
		args = append(args, q.Category)
		idx++
	}
	if q.Severity != "" {
		cond += " AND severity = $" + strconv.Itoa(idx)
		args = append(args, q.Severity)
		idx++
	}
	if q.Approved != nil {
		cond += " AND approved = $" + strconv.Itoa(idx)
		args = append(args, *q.Approved)
		idx++
	}

	limit := 20
	offset := 0
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	if q.Offset != nil {
		offset = *q.Offset
	}

	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM runbooks "+cond, args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.Runbook
	err = r.db.SelectContext(ctx, &items, cond+" ORDER BY created_at DESC LIMIT $"+strconv.Itoa(idx)+" OFFSET $"+strconv.Itoa(idx+1),
		append(args, limit, offset)...)
	return items, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Runbook, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	for k, v := range updates {
		switch t := v.(type) {
		case []models.RunbookStep:
			b, _ := json.Marshal(t)
			updates[k] = string(b)
		case []string:
			b, _ := json.Marshal(t)
			updates[k] = string(b)
		}
	}
	query, args, err := sqlx.Named(`UPDATE runbooks SET @:updates WHERE id = :id AND tenant_id = :tenant_id`,
		map[string]interface{}{"updates": updates, "id": id, "tenant_id": tenantID})
	if err != nil {
		return nil, err
	}
	_, err = r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `DELETE FROM runbook_execution_steps WHERE execution_id IN (SELECT id FROM runbook_executions WHERE runbook_id = $1)`, id)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM runbook_executions WHERE runbook_id = $1`, id)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM runbooks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return tx.Commit()
}

func (r *Repository) CreateExecution(ctx context.Context, tenantID string, ex *models.RunbookExecution) error {
	ex.ID = uuid.New().String()
	ex.TenantID = tenantID
	ex.StartedAt = time.Now().UTC()
	ex.CreatedAt = ex.StartedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO runbook_executions (id, tenant_id, runbook_id, incident_id, executor_id, status, started_at, completed_at, created_at)
		VALUES (:id, :tenant_id, :runbook_id, :incident_id, :executor_id, :status, :started_at, :completed_at, :created_at)`,
		ex)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID, runbookID string, limit int) ([]models.RunbookExecution, error) {
	var items []models.RunbookExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM runbook_executions WHERE tenant_id = $1 AND runbook_id = $2 ORDER BY started_at DESC LIMIT $3`,
		tenantID, runbookID, limit)
	return items, err
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, tenantID, executionID string, status string) error {
	completedAt := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE runbook_executions SET status = $1, completed_at = $2 WHERE id = $3 AND tenant_id = $4`,
		status, completedAt, executionID, tenantID)
	return err
}
