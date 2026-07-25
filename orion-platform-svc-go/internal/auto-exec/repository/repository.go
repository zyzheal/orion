// Package repository provides the data access layer for the auto-exec engine.
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

	"orion/platform-svc-go/internal/auto-exec/models"
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
		`CREATE TABLE IF NOT EXISTS execution_tasks (
			id              VARCHAR(64)  PRIMARY KEY,
			tenant_id       VARCHAR(64)  NOT NULL,
			name            VARCHAR(255) NOT NULL,
			type            VARCHAR(32)  NOT NULL,
			config          TEXT         DEFAULT '',
			plugin          VARCHAR(128) NOT NULL,
			plugin_params   TEXT         DEFAULT '{}',
			status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
			retry_count     INT          NOT NULL DEFAULT 0,
			max_retries     INT          NOT NULL DEFAULT 3,
			timeout         INT          NOT NULL DEFAULT 300,
			output          TEXT         DEFAULT '',
			error           TEXT         DEFAULT '',
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			started_at      TIMESTAMPTZ,
			finished_at     TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS execution_history (
			id          VARCHAR(64) PRIMARY KEY,
			task_id     VARCHAR(64) NOT NULL REFERENCES execution_tasks(id),
			action      VARCHAR(64) NOT NULL,
			result      TEXT,
			started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			finished_at TIMESTAMPTZ,
			duration_ms BIGINT
		)`,
		`CREATE TABLE IF NOT EXISTS plugin_spi (
			id          VARCHAR(64) PRIMARY KEY,
			tenant_id   VARCHAR(64) NOT NULL,
			name        VARCHAR(128) NOT NULL,
			category    VARCHAR(32)  NOT NULL,
			description TEXT         DEFAULT '',
			params      JSONB        DEFAULT '{}',
			enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("auto-exec AutoMigrate failed: %w", err)
		}
	}
	for _, s := range []string{
		`CREATE INDEX IF NOT EXISTS idx_execution_tasks_tenant ON execution_tasks(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_execution_tasks_status ON execution_tasks(tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_execution_history_task ON execution_history(task_id)`,
		`CREATE INDEX IF NOT EXISTS idx_plugin_spi_name ON plugin_spi(name)`,
	} {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("auto-exec index migration failed: %w", err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// ExecutionTask CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateTask(ctx context.Context, tenantID string, req *models.CreateTaskRequest) (*models.ExecutionTask, error) {
	now := time.Now().UTC()
	paramsJSON, err := json.Marshal(req.PluginParams)
	if err != nil {
		return nil, err
	}
	task := &models.ExecutionTask{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Type:         req.Type,
		Plugin:       req.Plugin,
		PluginParams: string(paramsJSON),
		Status:       models.StatusPending,
		MaxRetries:   clampInt(req.MaxRetries, 0, 10),
		Timeout:      clampInt(req.Timeout, 1, 3600),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	q := `INSERT INTO execution_tasks
		(id, tenant_id, name, type, plugin, plugin_params, status, retry_count, max_retries, timeout, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :type, :plugin, :plugin_params, :status, :retry_count, :max_retries, :timeout, :created_at, :updated_at)`
	_, err = r.db.NamedExecContext(ctx, q, task)
	return task, err
}

func (r *Repository) GetTask(ctx context.Context, tenantID, id string) (*models.ExecutionTask, error) {
	var t models.ExecutionTask
	err := r.db.GetContext(ctx, &t, `SELECT * FROM execution_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("task not found: %s", id)
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTasks(ctx context.Context, tenantID, status string, limit, offset int) (*models.TaskListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.TaskListResponse{}
	countQ, listQ, countArgs, listArgs := buildTaskQueries(status, tenantID, limit, offset)
	if err := r.db.GetContext(ctx, &resp.Total, countQ, countArgs...); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, listQ, listArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (r *Repository) UpdateTask(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.ExecutionTask, error) {
	if len(fields) == 0 {
		return r.GetTask(ctx, tenantID, id)
	}
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	delete(fields, "tenant_id")
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE execution_tasks SET `+set+` WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":        id,
			"tenant_id": tenantID,
		},
	)
	if err != nil {
		return nil, err
	}
	return r.GetTask(ctx, tenantID, id)
}

func (r *Repository) DeleteTask(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM execution_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("task not found: %s", id)
	}
	return nil
}

// ---------------------------------------------------------------------------
// ExecutionHistory CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateHistory(ctx context.Context, h *models.ExecutionHistory) error {
	h.ID = uuid.New().String()
	if h.StartedAt.IsZero() {
		h.StartedAt = time.Now().UTC()
	}
	q := `INSERT INTO execution_history (id, task_id, action, result, started_at, finished_at, duration_ms)
		VALUES (:id, :task_id, :action, :result, :started_at, :finished_at, :duration_ms)`
	_, err := r.db.NamedExecContext(ctx, q, h)
	return err
}

func (r *Repository) ListHistory(ctx context.Context, taskID string, limit, offset int) (*models.HistoryListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.HistoryListResponse{}
	if err := r.db.GetContext(ctx, &resp.Total, `SELECT COUNT(*) FROM execution_history WHERE task_id=$1`, taskID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, `SELECT * FROM execution_history WHERE task_id=$1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`, taskID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// PluginSPI CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreatePlugin(ctx context.Context, tenantID string, req *models.RegisterPluginRequest) (*models.PluginSPI, error) {
	now := time.Now().UTC()
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	paramsJSON := "{}"
	if req.Params != nil {
		b, err := json.Marshal(req.Params)
		if err != nil {
			return nil, err
		}
		paramsJSON = string(b)
	}
	p := &models.PluginSPI{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Category:    req.Category,
		Description: req.Description,
		Enabled:     enabled,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	q := `INSERT INTO plugin_spi (id, tenant_id, name, category, description, params, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :category, :description, :params, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, q, struct {
		ID          string    `db:"id"`
		TenantID    string    `db:"tenant_id"`
		Name        string    `db:"name"`
		Category    string    `db:"category"`
		Description string    `db:"description"`
		Params      string    `db:"params"`
		Enabled     bool      `db:"enabled"`
		CreatedAt   time.Time `db:"created_at"`
		UpdatedAt   time.Time `db:"updated_at"`
	}{p.ID, p.TenantID, p.Name, p.Category, p.Description, paramsJSON, p.Enabled, p.CreatedAt, p.UpdatedAt})
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repository) GetPlugin(ctx context.Context, name string) (*models.PluginSPI, error) {
	var p models.PluginSPI
	var paramsRaw sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT id, tenant_id, name, category, description, params, enabled, created_at, updated_at FROM plugin_spi WHERE name=$1`, name).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Category, &p.Description, &paramsRaw, &p.Enabled, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("plugin not found: %s", name)
		}
		return nil, err
	}
	if paramsRaw.Valid {
		if err := json.Unmarshal([]byte(paramsRaw.String), &p.Params); err != nil {
			p.Params = map[string]string{}
		}
	}
	return &p, nil
}

func (r *Repository) ListPlugins(ctx context.Context, tenantID, category string, limit, offset int) (*models.PluginListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.PluginListResponse{}
	countQ := `SELECT COUNT(*) FROM plugin_spi WHERE tenant_id=$1 OR tenant_id=''`
	listQ := `SELECT id, tenant_id, name, category, description, params, enabled, created_at, updated_at FROM plugin_spi WHERE tenant_id=$1 OR tenant_id='' ORDER BY name LIMIT $2 OFFSET $3`
	if err := r.db.GetContext(ctx, &resp.Total, countQ, tenantID); err != nil {
		return nil, err
	}
	type row struct {
		ID          string    `db:"id"`
		TenantID    string    `db:"tenant_id"`
		Name        string    `db:"name"`
		Category    string    `db:"category"`
		Description string    `db:"description"`
		ParamsRaw   string    `db:"params"`
		Enabled     bool      `db:"enabled"`
		CreatedAt   time.Time `db:"created_at"`
		UpdatedAt   time.Time `db:"updated_at"`
	}
	var rows []row
	if err := r.db.SelectContext(ctx, &rows, listQ, tenantID, limit, offset); err != nil {
		return nil, err
	}
	for _, rw := range rows {
		p := models.PluginSPI{
			ID:          rw.ID,
			TenantID:    rw.TenantID,
			Name:        rw.Name,
			Category:    rw.Category,
			Description: rw.Description,
			Enabled:     rw.Enabled,
			CreatedAt:   rw.CreatedAt,
			UpdatedAt:   rw.UpdatedAt,
			Params:      map[string]string{},
		}
		if rw.ParamsRaw != "" {
			_ = json.Unmarshal([]byte(rw.ParamsRaw), &p.Params)
		}
		resp.Data = append(resp.Data, p)
	}
	return resp, nil
}

func (r *Repository) UpdatePlugin(ctx context.Context, tenantID, name string, fields map[string]interface{}) (*models.PluginSPI, error) {
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	delete(fields, "name")
	delete(fields, "tenant_id")
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE plugin_spi SET `+set+` WHERE name=:name AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"name":      name,
			"tenant_id": tenantID,
		},
	)
	if err != nil {
		return nil, err
	}
	return r.GetPlugin(ctx, name)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// buildNamedSet converts map keys to ":key" for sqlx named parameters.
func buildNamedSet(fields map[string]interface{}) string {
	var parts []string
	for k := range fields {
		parts = append(parts, fmt.Sprintf("%s=:%s", k, k))
	}
	return joinStrings(parts, ", ")
}

func buildTaskQueries(status, tenantID string, limit, offset int) (string, string, []interface{}, []interface{}) {
	var countQ, listQ string
	var countArgs, listArgs []interface{}
	countQ = `SELECT COUNT(*) FROM execution_tasks WHERE tenant_id=$1`
	listQ = `SELECT * FROM execution_tasks WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	countArgs = []interface{}{tenantID}
	listArgs = []interface{}{tenantID, limit, offset}
	if status != "" {
		countQ = `SELECT COUNT(*) FROM execution_tasks WHERE tenant_id=$1 AND status=$2`
		listQ = `SELECT * FROM execution_tasks WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		countArgs = []interface{}{tenantID, status}
		listArgs = []interface{}{tenantID, status, limit, offset}
	}
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
