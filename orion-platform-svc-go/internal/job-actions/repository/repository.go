// Package repository provides the data access layer for job-actions.
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/job-actions/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// AutoMigrate — create tables + indexes if they do not exist
// ---------------------------------------------------------------------------

func (r *Repository) AutoMigrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS job_actions (
			id          VARCHAR(64) PRIMARY KEY,
			tenant_id   VARCHAR(64) NOT NULL,
			name        VARCHAR(255) NOT NULL,
			type        VARCHAR(64)  NOT NULL,
			description TEXT         DEFAULT '',
			params      TEXT         DEFAULT '{}',
			category    VARCHAR(32)  NOT NULL DEFAULT 'deployment',
			timeout     INT          NOT NULL DEFAULT 300,
			retry_count INT          NOT NULL DEFAULT 0,
			enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS job_action_executions (
			id          VARCHAR(64)  PRIMARY KEY,
			tenant_id   VARCHAR(64)  NOT NULL,
			action_id   VARCHAR(64)  NOT NULL REFERENCES job_actions(id),
			params      TEXT         DEFAULT '{}',
			status      VARCHAR(16)  NOT NULL DEFAULT 'pending',
			output      TEXT         DEFAULT '',
			error       TEXT         DEFAULT '',
			duration_ms BIGINT       NOT NULL DEFAULT 0,
			started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			finished_at TIMESTAMPTZ,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("job-actions AutoMigrate failed: %w", err)
		}
	}
	for _, s := range []string{
		`CREATE INDEX IF NOT EXISTS idx_job_actions_tenant ON job_actions(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_job_actions_type ON job_actions(type)`,
		`CREATE INDEX IF NOT EXISTS idx_job_actions_category ON job_actions(tenant_id, category)`,
		`CREATE INDEX IF NOT EXISTS idx_job_action_executions_action ON job_action_executions(action_id)`,
		`CREATE INDEX IF NOT EXISTS idx_job_action_executions_tenant ON job_action_executions(tenant_id)`,
	} {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("job-actions index migration failed: %w", err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// JobAction CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateAction(ctx context.Context, tenantID string, req *models.CreateActionRequest) (*models.JobAction, error) {
	now := time.Now().UTC()
	paramsJSON := "{}"
	if req.Params != nil {
		b, err := json.Marshal(req.Params)
		if err != nil {
			return nil, err
		}
		paramsJSON = string(b)
	}
	if req.Timeout <= 0 {
		req.Timeout = 300
	}
	if req.RetryCount < 0 {
		req.RetryCount = 0
	}
	if req.Category == "" {
		req.Category = models.CategoryDeployment
	}
	action := &models.JobAction{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
		Params:      paramsJSON,
		Category:    req.Category,
		Timeout:     clampInt(req.Timeout, 1, 3600),
		RetryCount:  clampInt(req.RetryCount, 0, 10),
		Enabled:     true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	q := `INSERT INTO job_actions
		(id, tenant_id, name, type, description, params, category, timeout, retry_count, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :type, :description, :params, :category, :timeout, :retry_count, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, q, action)
	return action, err
}

func (r *Repository) GetAction(ctx context.Context, tenantID, id string) (*models.JobAction, error) {
	var a models.JobAction
	err := r.db.GetContext(ctx, &a, `SELECT * FROM job_actions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("action not found: %s", id)
		}
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListActions(ctx context.Context, tenantID, category string, limit, offset int) (*models.ActionListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.ActionListResponse{}
	countQ, listQ, countArgs, listArgs := buildActionQueries(category, tenantID, limit, offset)
	if err := r.db.GetContext(ctx, &resp.Total, countQ, countArgs...); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, listQ, listArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (r *Repository) UpdateAction(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.JobAction, error) {
	if len(fields) == 0 {
		return r.GetAction(ctx, tenantID, id)
	}
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	delete(fields, "tenant_id")
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE job_actions SET `+set+` WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":        id,
			"tenant_id": tenantID,
		},
	)
	if err != nil {
		return nil, err
	}
	return r.GetAction(ctx, tenantID, id)
}

func (r *Repository) DeleteAction(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM job_actions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("action not found: %s", id)
	}
	return nil
}

// ---------------------------------------------------------------------------
// JobActionExecution CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateExecution(ctx context.Context, e *models.JobActionExecution) error {
	e.ID = uuid.New().String()
	if e.StartedAt.IsZero() {
		e.StartedAt = time.Now().UTC()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = e.StartedAt
	}
	paramsJSON := "{}"
	e.Params = paramsJSON
	q := `INSERT INTO job_action_executions
		(id, tenant_id, action_id, params, status, output, error, duration_ms, started_at, finished_at, created_at)
		VALUES (:id, :tenant_id, :action_id, :params, :status, :output, :error, :duration_ms, :started_at, :finished_at, :created_at)`
	_, err := r.db.NamedExecContext(ctx, q, e)
	return err
}

func (r *Repository) GetExecution(ctx context.Context, tenantID, id string) (*models.JobActionExecution, error) {
	var e models.JobActionExecution
	err := r.db.GetContext(ctx, &e, `SELECT * FROM job_action_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("execution not found: %s", id)
		}
		return nil, err
	}
	return &e, nil
}

func (r *Repository) UpdateExecution(ctx context.Context, tenantID, id string, fields map[string]interface{}) error {
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE job_action_executions SET `+set+` WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":        id,
			"tenant_id": tenantID,
		},
	)
	return err
}

func (r *Repository) ListHistory(ctx context.Context, actionID string, limit, offset int) (*models.HistoryListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.HistoryListResponse{}
	if err := r.db.GetContext(ctx, &resp.Total, `SELECT COUNT(*) FROM job_action_executions WHERE action_id=$1`, actionID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data,
		`SELECT * FROM job_action_executions WHERE action_id=$1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`, actionID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func buildNamedSet(fields map[string]interface{}) string {
	var parts []string
	for k := range fields {
		parts = append(parts, fmt.Sprintf("%s=:%s", k, k))
	}
	return joinStrings(parts, ", ")
}

func buildActionQueries(category, tenantID string, limit, offset int) (countQ, listQ string, countArgs, listArgs []interface{}) {
	if category != "" {
		countQ = `SELECT COUNT(*) FROM job_actions WHERE tenant_id=$1 AND category=$2`
		listQ = `SELECT * FROM job_actions WHERE tenant_id=$1 AND category=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		countArgs = []interface{}{tenantID, category}
		listArgs = []interface{}{tenantID, category, limit, offset}
		return countQ, listQ, countArgs, listArgs
	}
	countQ = `SELECT COUNT(*) FROM job_actions WHERE tenant_id=$1`
	listQ = `SELECT * FROM job_actions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	countArgs = []interface{}{tenantID}
	listArgs = []interface{}{tenantID, limit, offset}
	return countQ, listQ, countArgs, listArgs
}

func joinStrings(parts []string, sep string) string {
	return strings.Join(parts, sep)
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func clampInt(v, lo, hi int) int {
	return clamp(v, lo, hi)
}
