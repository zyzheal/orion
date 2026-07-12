package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/page-registry/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, m *models.PageRegistry) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO page_registries (id, tenant_id, path, component, protected, permission, hide_layout, micro_app, sub_app_key, menu_key, menu_label, menu_icon, hidden, redirect_to, title, breadcrumb, sort_order, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :path, :component, :protected, :permission, :hide_layout, :micro_app, :sub_app_key, :menu_key, :menu_label, :menu_icon, :hidden, :redirect_to, :title, :breadcrumb, :sort_order, :status, :created_at, :updated_at)`, m)
	if err != nil {
		return fmt.Errorf("failed to create page registry: %w", err)
	}
	return nil
}

func (r *Repository) GetByPath(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	var m models.PageRegistry
	err := r.db.GetContext(ctx, &m, `SELECT * FROM page_registries WHERE path=$1 AND tenant_id=$2`, path, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	var items []models.PageRegistry
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM page_registries WHERE tenant_id=$1 ORDER BY sort_order ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetEnabled(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	var items []models.PageRegistry
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM page_registries WHERE tenant_id=$1 AND status=$2 ORDER BY sort_order ASC`, tenantID, "enabled")
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, path string, updates map[string]interface{}) (*models.PageRegistry, error) {
	updates["updated_at"] = time.Now().UTC()
	if len(updates) < 2 { // only updated_at
		return nil, fmt.Errorf("no fields to update")
	}
	setClause := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	argIndex := 1
	for key, value := range updates {
		setClause = append(setClause, fmt.Sprintf("%s=$%d", key, argIndex))
		args = append(args, value)
		argIndex++
	}
	// Append path and tenant_id
	args = append(args, path, tenantID)

	// Build SET clause
	sb := &strings.Builder{}
	sb.WriteString("UPDATE page_registries SET ")
	for i, s := range setClause {
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(s)
	}
	sb.WriteString(fmt.Sprintf(" WHERE path=$%d AND tenant_id=$%d", argIndex, argIndex+1))
	query := sb.String()

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("page registry not found: %s", path)
	}

	// Return the updated record
	return r.GetByPath(ctx, tenantID, path)
}

func (r *Repository) Delete(ctx context.Context, tenantID, path string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM page_registries WHERE path=$1 AND tenant_id=$2`, path, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("page registry not found: %s", path)
	}
	return nil
}

// ToggleStatus flips the status between enabled and disabled.
func (r *Repository) ToggleStatus(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	// Get current
	current, err := r.GetByPath(ctx, tenantID, path)
	if err != nil {
		return nil, err
	}
	newStatus := "disabled"
	if current.Status == "enabled" || current.Status == "" {
		newStatus = "enabled"
	} else {
		newStatus = "disabled"
	}

	_, err = r.db.ExecContext(ctx, `UPDATE page_registries SET status=$1, updated_at=$2 WHERE path=$3 AND tenant_id=$4`, newStatus, time.Now().UTC(), path, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to toggle status: %w", err)
	}

	// Write history
	if current.ID != "" {
		_ = r.writeHistory(ctx, tenantID, current.ID, "toggle_status", "", fmt.Sprintf(`{"status":{"old":"%s","new":"%s"}}`, current.Status, newStatus), "")
	}

	return r.GetByPath(ctx, tenantID, path)
}

// GetHistory returns history entries for a given page path.
func (r *Repository) GetHistory(ctx context.Context, tenantID, path string) ([]models.PageRegistryHistory, error) {
	// First get the page ID
	page, err := r.GetByPath(ctx, tenantID, path)
	if err != nil {
		return nil, err
	}

	var history []models.PageRegistryHistory
	err = r.db.SelectContext(ctx, &history, `SELECT * FROM page_registry_history WHERE page_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, page.ID, tenantID)
	if err != nil {
		return nil, err
	}
	return history, nil
}

func (r *Repository) writeHistory(ctx context.Context, tenantID, pageID, action, changedBy, changes, newValue string) error {
	h := &models.PageRegistryHistory{
		ID:        uuid.New().String(),
		PageID:    pageID,
		TenantID:  tenantID,
		Action:    action,
		ChangedBy: changedBy,
		Changes:   &changes,
		NewValue:  &newValue,
		CreatedAt: time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO page_registry_history (id, page_id, tenant_id, action, changed_by, changes, new_value, created_at)
		 VALUES (:id, :page_id, :tenant_id, :action, :changed_by, :changes, :new_value, :created_at)`, h)
	return err
}

// PathExists checks if a path already exists for a tenant (for conflict detection).
func (r *Repository) PathExists(ctx context.Context, tenantID, path string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM page_registries WHERE path=$1 AND tenant_id=$2)`, path, tenantID)
	return exists, err
}
