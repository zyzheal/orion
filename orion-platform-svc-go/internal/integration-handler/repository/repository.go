// Package repository provides data access for all Integration Handler entities.
// Implements PostgreSQL-backed storage via sqlx for integrations,
// integration_tasks, and integration_logs tables.
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/integration-handler/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for integrations, tasks, and logs.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Integration CRUD
// ===========================================================================

// CreateIntegration inserts a new integration record. Generates UUID for id.
func (r *Repository) CreateIntegration(ctx context.Context, tenantID, name, intType, handlerType string, config map[string]string) (*models.Integration, error) {
	id := uuid.New().String()
	configJSON := "{}"
	if config != nil {
		if b, err := json.Marshal(config); err == nil {
			configJSON = string(b)
		}
	}
	now := time.Now().UTC()

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO integrations (id, tenant_id, name, type, handler_type, config, status, error, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		id, tenantID, name, intType, handlerType, configJSON,
		string(models.IntegrationStatusEnabled), "", true, now, now,
	)
	if err != nil {
		return nil, err
	}

	return &models.Integration{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Type:        intType,
		HandlerType: handlerType,
		Config:      configJSON,
		Status:      string(models.IntegrationStatusEnabled),
		Enabled:     true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// GetIntegrationByID returns a single integration by its UUID.
func (r *Repository) GetIntegrationByID(ctx context.Context, id string) (*models.Integration, error) {
	var i models.Integration
	err := r.db.GetContext(ctx, &i,
		`SELECT id, tenant_id, name, type, handler_type, config, status, error,
		        enabled, created_at, updated_at
		 FROM integrations
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// GetIntegrationByTenant returns an integration by ID with tenant verification.
func (r *Repository) GetIntegrationByTenant(ctx context.Context, tenantID, id string) (*models.Integration, error) {
	var i models.Integration
	err := r.db.GetContext(ctx, &i,
		`SELECT id, tenant_id, name, type, handler_type, config, status, error,
		        enabled, created_at, updated_at
		 FROM integrations
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// ListIntegrations returns paginated integrations, filtered by tenant.
func (r *Repository) ListIntegrations(ctx context.Context, tenantID, intType string, offset, limit int) ([]models.Integration, error) {
	var items []models.Integration
	var err error

	if tenantID != "" && intType != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, handler_type, config, status, error,
			        enabled, created_at, updated_at
			 FROM integrations
			 WHERE tenant_id = $1 AND type = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, intType, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, handler_type, config, status, error,
			        enabled, created_at, updated_at
			 FROM integrations
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, handler_type, config, status, error,
			        enabled, created_at, updated_at
			 FROM integrations
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// UpdateIntegration updates an integration's mutable fields using dynamic SET clause.
func (r *Repository) UpdateIntegration(ctx context.Context, tenantID, id string, name, intType, handlerType *string, config map[string]string, status *string, enabled *bool) (*models.Integration, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *name)
		argIdx++
	}
	if intType != nil {
		setClauses = append(setClauses, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, *intType)
		argIdx++
	}
	if handlerType != nil {
		setClauses = append(setClauses, fmt.Sprintf("handler_type = $%d", argIdx))
		args = append(args, *handlerType)
		argIdx++
	}
	if config != nil {
		configJSON := "{}"
		if b, err := json.Marshal(config); err == nil {
			configJSON = string(b)
		}
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, configJSON)
		argIdx++
	}
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

	if len(setClauses) == 0 {
		return nil, ErrNotFound
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE integrations SET %s WHERE id = $%d AND tenant_id = $%d",
		joinStrings(setClauses, ", "), argIdx, argIdx+1)
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetIntegrationByID(ctx, id)
}

// DeleteIntegration removes an integration by ID with tenant verification.
func (r *Repository) DeleteIntegration(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM integrations WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// CountIntegrations returns integration count, optionally filtered by tenant.
func (r *Repository) CountIntegrations(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM integrations WHERE tenant_id = $1`, tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM integrations`,
	)
	return count, err
}

// ===========================================================================
// IntegrationTask CRUD
// ===========================================================================

// CreateTask inserts a new task record with status=pending.
func (r *Repository) CreateTask(ctx context.Context, tenantID, integrationID, direction string, data map[string]interface{}) (*models.IntegrationTask, error) {
	id := uuid.New().String()
	dataJSON := "{}"
	if data != nil {
		if b, err := json.Marshal(data); err == nil {
			dataJSON = string(b)
		}
	}
	now := time.Now().UTC()

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO integration_tasks (id, tenant_id, integration_id, direction, data, status, error, response, started_at, finished_at, duration_ms, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		id, tenantID, integrationID, direction, dataJSON,
		string(models.TaskStatusPending), "", "", now, sql.NullTime{}, 0, now,
	)
	if err != nil {
		return nil, err
	}

	return &models.IntegrationTask{
		ID:            id,
		TenantID:      tenantID,
		IntegrationID: integrationID,
		Direction:     direction,
		Data:          dataJSON,
		Status:        string(models.TaskStatusPending),
		StartedAt:     now,
		CreatedAt:     now,
	}, nil
}

// GetTaskByID returns a single task by its UUID.
func (r *Repository) GetTaskByID(ctx context.Context, id string) (*models.IntegrationTask, error) {
	var t models.IntegrationTask
	err := r.db.GetContext(ctx, &t,
		`SELECT id, tenant_id, integration_id, direction, data, status, error, response,
		        started_at, finished_at, duration_ms, created_at
		 FROM integration_tasks
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetTaskByTenant returns a task by ID with tenant verification.
func (r *Repository) GetTaskByTenant(ctx context.Context, tenantID, id string) (*models.IntegrationTask, error) {
	var t models.IntegrationTask
	err := r.db.GetContext(ctx, &t,
		`SELECT id, tenant_id, integration_id, direction, data, status, error, response,
		        started_at, finished_at, duration_ms, created_at
		 FROM integration_tasks
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTasksByIntegration returns paginated tasks for an integration.
func (r *Repository) ListTasksByIntegration(ctx context.Context, tenantID, integrationID, status string, offset, limit int) ([]models.IntegrationTask, error) {
	var items []models.IntegrationTask
	var err error

	if integrationID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, integration_id, direction, data, status, error, response,
			        started_at, finished_at, duration_ms, created_at
			 FROM integration_tasks
			 WHERE tenant_id = $1 AND integration_id = $2 AND status = $3
			 ORDER BY created_at DESC
			 OFFSET $4 LIMIT $5`,
			tenantID, integrationID, status, offset, limit,
		)
	} else if integrationID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, integration_id, direction, data, status, error, response,
			        started_at, finished_at, duration_ms, created_at
			 FROM integration_tasks
			 WHERE tenant_id = $1 AND integration_id = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, integrationID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, integration_id, direction, data, status, error, response,
			        started_at, finished_at, duration_ms, created_at
			 FROM integration_tasks
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	}
	return items, err
}

// UpdateTaskStatus transitions a task to a new status with optional result data.
func (r *Repository) UpdateTaskStatus(ctx context.Context, tenantID, id string, status, errMsg, response string, durationMs int64, finishedAt *time.Time) (*models.IntegrationTask, error) {
	setClauses := []string{"status = $1"}
	args := []interface{}{status}
	argIdx := 2

	if errMsg != "" {
		setClauses = append(setClauses, fmt.Sprintf("error = $%d", argIdx))
		args = append(args, errMsg)
		argIdx++
	}
	if response != "" {
		setClauses = append(setClauses, fmt.Sprintf("response = $%d", argIdx))
		args = append(args, response)
		argIdx++
	}
	if durationMs > 0 {
		setClauses = append(setClauses, fmt.Sprintf("duration_ms = $%d", argIdx))
		args = append(args, durationMs)
		argIdx++
	}
	if finishedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("finished_at = $%d", argIdx))
		args = append(args, *finishedAt)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE integration_tasks SET %s WHERE id = $%d AND tenant_id = $%d",
		joinStrings(setClauses, ", "), argIdx, argIdx+1)
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetTaskByID(ctx, id)
}

// DeleteTask removes a task by ID with tenant verification.
func (r *Repository) DeleteTask(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM integration_tasks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// CountTasksByIntegration returns task count for an integration.
func (r *Repository) CountTasksByIntegration(ctx context.Context, tenantID, integrationID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM integration_tasks WHERE tenant_id = $1 AND integration_id = $2`,
		tenantID, integrationID,
	)
	return count, err
}

// ===========================================================================
// IntegrationLog CRUD
// ===========================================================================

// CreateLog inserts a new log entry.
func (r *Repository) CreateLog(ctx context.Context, taskID, level, message, details string) (*models.IntegrationLog, error) {
	id := uuid.New().String()
	detailsJSON := "{}"
	if details != "" {
		detailsJSON = details
	}
	now := time.Now().UTC()

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO integration_logs (id, task_id, level, message, details, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		id, taskID, level, message, detailsJSON, now,
	)
	if err != nil {
		return nil, err
	}

	return &models.IntegrationLog{
		ID:        id,
		TaskID:    taskID,
		Level:     level,
		Message:   message,
		Details:   detailsJSON,
		CreatedAt: now,
	}, nil
}

// ListLogsByTask returns recent logs for a task.
func (r *Repository) ListLogsByTask(ctx context.Context, taskID string, offset, limit int) ([]models.IntegrationLog, error) {
	var items []models.IntegrationLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, task_id, level, message, details, created_at
		 FROM integration_logs
		 WHERE task_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		taskID, offset, limit,
	)
	return items, err
}

// CountLogsByTask returns log count for a task.
func (r *Repository) CountLogsByTask(ctx context.Context, taskID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM integration_logs WHERE task_id = $1`, taskID,
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
