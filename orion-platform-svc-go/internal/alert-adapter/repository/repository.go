// Package repository provides data access for all Alert Adapter SPI entities.
// Implements PostgreSQL-backed storage via sqlx for alert_adapters and
// alert_events tables.
//
// Translated from TS blueprint: blueprints/orion-alert-adapter-svc (SPI pattern
// inspired by NeatLogic IAdapter interface).
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-adapter/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for alert adapters and events.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// AlertAdapter CRUD
// ===========================================================================

// CreateAdapter inserts a new alert adapter. Generates UUID for id.
func (r *Repository) CreateAdapter(ctx context.Context, a *models.AlertAdapter) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = "enabled"
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_adapters
			(id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		a.ID, a.TenantID, a.Name, a.Type, a.Category, a.Config,
		a.Status, a.Enabled, a.Error, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetAdapterByID returns an adapter by its UUID.
func (r *Repository) GetAdapterByID(ctx context.Context, id string) (*models.AlertAdapter, error) {
	var a models.AlertAdapter
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
		 FROM alert_adapters
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAdapters returns paginated adapters, optionally filtered by tenant, type, and category.
func (r *Repository) ListAdapters(ctx context.Context, tenantID, atype, category string, offset, limit int) ([]models.AlertAdapter, error) {
	var items []models.AlertAdapter
	var err error

	if tenantID != "" && atype != "" && category != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
			 FROM alert_adapters
			 WHERE tenant_id = $1 AND type = $2 AND category = $3
			 ORDER BY created_at DESC
			 OFFSET $4 LIMIT $5`,
			tenantID, atype, category, offset, limit,
		)
	} else if tenantID != "" && atype != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
			 FROM alert_adapters
			 WHERE tenant_id = $1 AND type = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, atype, offset, limit,
		)
	} else if tenantID != "" && category != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
			 FROM alert_adapters
			 WHERE tenant_id = $1 AND category = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, category, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
			 FROM alert_adapters
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, type, category, config, status, enabled, error, created_at, updated_at
			 FROM alert_adapters
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// UpdateAdapter updates an adapter's mutable fields using dynamic SET clause.
func (r *Repository) UpdateAdapter(ctx context.Context, id string, name, atype, category *string, config *string, enabled *bool, status, errMsg *string) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *name)
		argIdx++
	}
	if atype != nil {
		setClauses = append(setClauses, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, *atype)
		argIdx++
	}
	if category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, *category)
		argIdx++
	}
	if config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, *config)
		argIdx++
	}
	if enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}
	if status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *status)
		argIdx++
	}
	if errMsg != nil {
		setClauses = append(setClauses, fmt.Sprintf("error = $%d", argIdx))
		args = append(args, *errMsg)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE alert_adapters SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteAdapter removes an adapter by ID.
func (r *Repository) DeleteAdapter(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM alert_adapters WHERE id = $1`,
		id,
	)
	return err
}

// CountAdapters returns adapter count, optionally filtered by tenant.
func (r *Repository) CountAdapters(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM alert_adapters WHERE tenant_id = $1`,
			tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM alert_adapters`,
	)
	return count, err
}

// ===========================================================================
// AlertEvent CRUD
// ===========================================================================

// CreateEvent inserts a new alert event. Generates UUID for id.
func (r *Repository) CreateEvent(ctx context.Context, e *models.AlertEvent) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	e.CreatedAt = now
	if e.Status == "" {
		e.Status = "received"
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_events
			(id, tenant_id, adapter_id, source, title, message, severity, labels, payload, status, processed_at, error, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		e.ID, e.TenantID, e.AdapterID, e.Source, e.Title, e.Message,
		e.Severity, e.Labels, e.Payload, e.Status, e.ProcessedAt, e.Error, e.CreatedAt,
	)
	return err
}

// GetEventByID returns an event by its UUID.
func (r *Repository) GetEventByID(ctx context.Context, id string) (*models.AlertEvent, error) {
	var e models.AlertEvent
	err := r.db.GetContext(ctx, &e,
		`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
		        status, processed_at, error, created_at
		 FROM alert_events
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ListEventsByAdapter returns paginated events for a specific adapter, optionally filtered by status.
func (r *Repository) ListEventsByAdapter(ctx context.Context, adapterID, tenantID, status string, offset, limit int) ([]models.AlertEvent, error) {
	var items []models.AlertEvent
	var err error

	if tenantID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE adapter_id = $1 AND tenant_id = $2 AND status = $3
			 ORDER BY created_at DESC
			 OFFSET $4 LIMIT $5`,
			adapterID, tenantID, status, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE adapter_id = $1 AND tenant_id = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			adapterID, tenantID, offset, limit,
		)
	} else if status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE adapter_id = $1 AND status = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			adapterID, status, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE adapter_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			adapterID, offset, limit,
		)
	}
	return items, err
}

// ListEvents returns paginated events filtered by tenant, optionally by status and severity.
func (r *Repository) ListEvents(ctx context.Context, tenantID, status, severity string, offset, limit int) ([]models.AlertEvent, error) {
	var items []models.AlertEvent
	var err error

	if tenantID != "" && status != "" && severity != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE tenant_id = $1 AND status = $2 AND severity = $3
			 ORDER BY created_at DESC
			 OFFSET $4 LIMIT $5`,
			tenantID, status, severity, offset, limit,
		)
	} else if tenantID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE tenant_id = $1 AND status = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, status, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, adapter_id, source, title, message, severity, labels, payload,
			        status, processed_at, error, created_at
			 FROM alert_events
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// MarkEventProcessed updates an event's status to processed with a timestamp.
func (r *Repository) MarkEventProcessed(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_events SET status = $1, processed_at = $2, error = '' WHERE id = $3`,
		"processed", now, id,
	)
	return err
}

// MarkEventFailed updates an event's status to failed with an error message.
func (r *Repository) MarkEventFailed(ctx context.Context, id, errMsg string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_events SET status = $1, error = $2 WHERE id = $3`,
		"failed", errMsg, id,
	)
	return err
}

// CountEventsByAdapter returns event count for a specific adapter.
func (r *Repository) CountEventsByAdapter(ctx context.Context, adapterID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM alert_events WHERE adapter_id = $1`,
		adapterID,
	)
	return count, err
}

// CountEventsByTenant returns event count for a tenant.
func (r *Repository) CountEventsByTenant(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM alert_events WHERE tenant_id = $1`,
			tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM alert_events`,
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
