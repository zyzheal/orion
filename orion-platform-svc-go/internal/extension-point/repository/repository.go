// Package repository provides data access for Extension Point entities.
// Implements PostgreSQL-backed storage via sqlx for extension_points and
// startup_tasks tables.
//
// Tables: extension_points, startup_tasks
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/extension-point/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key: name")
)

// Repository provides data access for extension points and startup tasks.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// AutoMigrate — creates tables if they do not exist
// ===========================================================================

// AutoMigrate creates the extension_points and startup_tasks tables if missing.
func (r *Repository) AutoMigrate(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS extension_points (
			id UUID PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL DEFAULT '',
			name VARCHAR(128) NOT NULL,
			category VARCHAR(32) NOT NULL,
			description TEXT,
			handler_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
			config JSONB DEFAULT '{}',
			enabled BOOLEAN DEFAULT true,
			priority INT DEFAULT 0,
			status VARCHAR(32) NOT NULL DEFAULT 'registered',
			error TEXT,
			registered_at TIMESTAMP DEFAULT NOW(),
			initialized_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS startup_tasks (
			id UUID PRIMARY KEY,
			extension_id VARCHAR(128) NOT NULL,
			name VARCHAR(128) NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			duration_ms BIGINT DEFAULT 0,
			error TEXT,
			started_at TIMESTAMP DEFAULT NOW(),
			finished_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
	}

	for _, q := range queries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("auto migrate failed: %w", err)
		}
	}

	// Unique constraint (PostgreSQL does not support IF NOT EXISTS on indexes,
	// so we guard with a query first).
	idxQueries := map[string]string{
		"idx_extension_points_name_tenant": `CREATE INDEX IF NOT EXISTS idx_extension_points_name_tenant ON extension_points(tenant_id, name)`,
		"idx_extension_points_category":    `CREATE INDEX IF NOT EXISTS idx_extension_points_category ON extension_points(category)`,
		"idx_extension_points_status":      `CREATE INDEX IF NOT EXISTS idx_extension_points_status ON extension_points(status)`,
		"idx_extension_points_tenant":      `CREATE INDEX IF NOT EXISTS idx_extension_points_tenant ON extension_points(tenant_id)`,
		"idx_startup_tasks_extension":      `CREATE INDEX IF NOT EXISTS idx_startup_tasks_extension ON startup_tasks(extension_id)`,
		"idx_startup_tasks_status":         `CREATE INDEX IF NOT EXISTS idx_startup_tasks_status ON startup_tasks(status)`,
	}
	for name, q := range idxQueries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("auto migrate index %s failed: %w", name, err)
		}
	}

	return nil
}

// ===========================================================================
// ExtensionPoint CRUD
// ===========================================================================

// CreateExtensionPoint inserts a new extension point.
func (r *Repository) CreateExtensionPoint(ctx context.Context, ep *models.ExtensionPoint) error {
	if ep.ID == "" {
		ep.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	ep.RegisteredAt = now
	ep.CreatedAt = now
	ep.UpdatedAt = now
	if ep.HandlerType == "" {
		ep.HandlerType = models.HandlerTypeBuiltin
	}
	if ep.Status == "" {
		ep.Status = models.StatusRegistered
	}
	if ep.Config == nil {
		ep.Config = models.JSONB{}
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO extension_points
			(id, tenant_id, name, category, description, handler_type, config,
			 enabled, priority, status, registered_at, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		ep.ID, ep.TenantID, ep.Name, ep.Category, ep.Description, ep.HandlerType,
		ep.Config, ep.Enabled, ep.Priority, ep.Status, ep.RegisteredAt,
		ep.CreatedAt, ep.UpdatedAt,
	)
	return err
}

// GetExtensionPoint returns an extension point by tenant_id + name.
func (r *Repository) GetExtensionPoint(ctx context.Context, tenantID, name string) (*models.ExtensionPoint, error) {
	var ep models.ExtensionPoint
	err := r.db.GetContext(ctx, &ep,
		`SELECT id, tenant_id, name, category, description, handler_type, config,
		        enabled, priority, status, error, registered_at, initialized_at,
		        created_at, updated_at
		 FROM extension_points
		 WHERE tenant_id = $1 AND name = $2`,
		tenantID, name,
	)
	if err != nil {
		return nil, err
	}
	return &ep, nil
}

// GetExtensionPointByID returns an extension point by its UUID.
func (r *Repository) GetExtensionPointByID(ctx context.Context, id string) (*models.ExtensionPoint, error) {
	var ep models.ExtensionPoint
	err := r.db.GetContext(ctx, &ep,
		`SELECT id, tenant_id, name, category, description, handler_type, config,
		        enabled, priority, status, error, registered_at, initialized_at,
		        created_at, updated_at
		 FROM extension_points
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &ep, nil
}

// ListExtensionPoints returns paginated extension points, optionally filtered
// by tenant, category, and/or status.
func (r *Repository) ListExtensionPoints(ctx context.Context, tenantID, category, status string, offset, limit int) ([]models.ExtensionPoint, error) {
	var items []models.ExtensionPoint
	var err error

	var where string
	var argsList []interface{}
	argsList = append(argsList, tenantID, offset, limit)
	parts := []string{"tenant_id = $1"}
	idx := 2
	if category != "" {
		parts = append(parts, fmt.Sprintf("category = $%d", idx))
		argsList = append(argsList, category)
		idx++
	}
	if status != "" {
		parts = append(parts, fmt.Sprintf("status = $%d", idx))
		argsList = append(argsList, status)
		idx++
	}
	where = strings.Join(parts, " AND ")
	whereArgs := fmt.Sprintf(" OFFSET $%d LIMIT $%d", idx, idx+1)

	argsList = append(argsList, offset, limit)
	where = fmt.Sprintf("%s%s", where, whereArgs)
	query := fmt.Sprintf(`SELECT id, tenant_id, name, category, description, handler_type,
		        config, enabled, priority, status, error, registered_at, initialized_at,
		        created_at, updated_at FROM extension_points WHERE %s ORDER BY priority ASC, created_at DESC`, where)

	err = r.db.SelectContext(ctx, &items, query, argsList...)
	return items, err
}

// UpdateExtensionPoint updates mutable fields dynamically.
func (r *Repository) UpdateExtensionPoint(ctx context.Context, tenantID, name string, status *string, enabled *bool, priority *int, config *models.JSONB, description *string, errs *string) (*models.ExtensionPoint, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *status)
		argIdx++
	}
	if enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}
	if priority != nil {
		pi := *priority
		setClauses = append(setClauses, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, &pi)
		argIdx++
	}
	if config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, *config)
		argIdx++
	}
	if description != nil {
		d := *description
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, &d)
		argIdx++
	}
	if errs != nil {
		e := *errs
		setClauses = append(setClauses, fmt.Sprintf("\"error\" = $%d", argIdx))
		args = append(args, &e)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetExtensionPoint(ctx, tenantID, name)
	}

	setClauses = append(setClauses, "updated_at = now()")
	setClauses = append(setClauses, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++
	setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
	args = append(args, name)
	argIdx++

	query := fmt.Sprintf(
		`UPDATE extension_points SET %s RETURNING id, tenant_id, name, category,
		        description, handler_type, config, enabled, priority, status, error,
		        registered_at, initialized_at, created_at, updated_at`,
		joinStrings(setClauses, ", "),
	)
	var ep models.ExtensionPoint
	err := r.db.GetContext(ctx, &ep, query, args...)
	if err != nil {
		return nil, err
	}
	return &ep, nil
}

// SetInitialized marks an extension point as initialized with a timestamp.
func (r *Repository) SetInitialized(ctx context.Context, tenantID, name string, status string, errMsg *string) (*models.ExtensionPoint, error) {
	var e string
	if errMsg != nil {
		e = *errMsg
	}
	return r.UpdateExtensionPoint(ctx, tenantID, name, &status, nil, nil, nil, nil, &e)
}

// SetInitializedTime updates initialized_at and status atomically.
func (r *Repository) SetInitializedTime(ctx context.Context, tenantID, name string, status string) (*models.ExtensionPoint, error) {
	var ep models.ExtensionPoint
	now := time.Now().UTC()
	err := r.db.GetContext(ctx, &ep,
		`UPDATE extension_points
		 SET status = $1, initialized_at = $2, updated_at = $2
		 WHERE tenant_id = $3 AND name = $4
		 RETURNING id, tenant_id, name, category, description, handler_type, config,
		        enabled, priority, status, error, registered_at, initialized_at,
		        created_at, updated_at`,
		status, now, tenantID, name,
	)
	if err != nil {
		return nil, err
	}
	return &ep, nil
}

// DeleteExtensionPoint removes an extension point.
func (r *Repository) DeleteExtensionPoint(ctx context.Context, tenantID, name string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM extension_points WHERE tenant_id = $1 AND name = $2`,
		tenantID, name,
	)
	return err
}

// CountExtensionPoints returns total extension point count for a tenant.
func (r *Repository) CountExtensionPoints(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM extension_points WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// CountExtensionPointsByStatus returns count filtered by status.
func (r *Repository) CountExtensionPointsByStatus(ctx context.Context, tenantID, status string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM extension_points WHERE tenant_id = $1 AND status = $2`,
		tenantID, status,
	)
	return count, err
}

// ===========================================================================
// StartupTask CRUD
// ===========================================================================

// CreateStartupTask inserts a new startup task.
func (r *Repository) CreateStartupTask(ctx context.Context, st *models.StartupTask) error {
	if st.ID == "" {
		st.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	st.CreatedAt = now
	st.StartedAt = now
	if st.Status == "" {
		st.Status = models.TaskStatusPending
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO startup_tasks (id, extension_id, name, status, started_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		st.ID, st.ExtensionID, st.Name, st.Status, st.StartedAt, st.CreatedAt,
	)
	return err
}

// GetStartupTask returns a startup task by ID.
func (r *Repository) GetStartupTask(ctx context.Context, id string) (*models.StartupTask, error) {
	var st models.StartupTask
	err := r.db.GetContext(ctx, &st,
		`SELECT id, extension_id, name, status, duration_ms, error, started_at,
		        finished_at, created_at FROM startup_tasks WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// GetStartupTaskByExtension returns the latest startup task for an extension.
func (r *Repository) GetStartupTaskByExtension(ctx context.Context, extensionID string) (*models.StartupTask, error) {
	var st models.StartupTask
	err := r.db.GetContext(ctx, &st,
		`SELECT id, extension_id, name, status, duration_ms, error, started_at,
		        finished_at, created_at FROM startup_tasks
		 WHERE extension_id = $1 ORDER BY created_at DESC LIMIT 1`,
		extensionID,
	)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// ListStartupTasks returns paginated startup tasks, optionally filtered by status.
func (r *Repository) ListStartupTasks(ctx context.Context, status string, offset, limit int) ([]models.StartupTask, error) {
	var items []models.StartupTask
	var err error

	if status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, extension_id, name, status, duration_ms, error, started_at,
			        finished_at, created_at FROM startup_tasks
			 WHERE status = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
			status, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, extension_id, name, status, duration_ms, error, started_at,
			        finished_at, created_at FROM startup_tasks
			 ORDER BY created_at DESC OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// MarkRunning transitions a startup task to running.
func (r *Repository) MarkRunning(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE startup_tasks SET status = $1 WHERE id = $2`,
		models.TaskStatusRunning, id,
	)
	return err
}

// MarkComplete transitions a startup task to completed with duration.
func (r *Repository) MarkComplete(ctx context.Context, id string, durationMs int64) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE startup_tasks
		 SET status = $1, duration_ms = $2, finished_at = $3
		 WHERE id = $4`,
		models.TaskStatusCompleted, durationMs, now, id,
	)
	return err
}

// MarkFailed transitions a startup task to failed with error.
func (r *Repository) MarkFailed(ctx context.Context, id string, durationMs int64, errMsg string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE startup_tasks
		 SET status = $1, duration_ms = $2, error = $3, finished_at = $4
		 WHERE id = $5`,
		models.TaskStatusFailed, durationMs, errMsg, now, id,
	)
	return err
}

// CountStartupTasks returns total startup task count.
func (r *Repository) CountStartupTasks(ctx context.Context) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM startup_tasks`,
	)
	return count, err
}

// CountStartupTasksByStatus returns count filtered by status.
func (r *Repository) CountStartupTasksByStatus(ctx context.Context, status string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM startup_tasks WHERE status = $1`,
		status,
	)
	return count, err
}

// ===========================================================================
// Helpers
// ===========================================================================

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

// toMapStringString converts JSONB to the simpler map[string]string used in responses.
func toMapStringString(j models.JSONB) map[string]string {
	if j == nil {
		return nil
	}
	m := make(map[string]string, len(j))
	for k, v := range j {
		switch val := v.(type) {
		case string:
			m[k] = val
		default:
			b, _ := json.Marshal(val)
			m[k] = string(b)
		}
	}
	return m
}

// ExtensionPointToSummary converts an ExtensionPoint to an ExtensionSummary.
func ExtensionPointToSummary(ep models.ExtensionPoint) models.ExtensionSummary {
	return models.ExtensionSummary{
		Name:          ep.Name,
		Category:      ep.Category,
		Description:   ep.Description,
		Status:        ep.Status,
		Enabled:       ep.Enabled,
		Priority:      ep.Priority,
		HandlerType:   ep.HandlerType,
		Config:        toMapStringString(ep.Config),
		InitializedAt: ep.InitializedAt,
		CreatedAt:     ep.CreatedAt,
	}
}
