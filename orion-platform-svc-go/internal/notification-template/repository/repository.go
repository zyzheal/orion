package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification-template/models"

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

// Create inserts a new notification template.
func (r *Repository) Create(ctx context.Context, tpl *models.NotificationTemplate) error {
	tpl.ID = uuid.New().String()
	tpl.CreatedAt = time.Now().UTC()
	tpl.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notification_templates (id, tenant_id, user_id, name, description, channel, title_template, body_template, variables, enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :userId, :name, :description, :channel, :titleTemplate, :bodyTemplate, :variables, :enabled, :createdAt, :updatedAt)`,
		tpl)
	return err
}

// GetByID retrieves a notification template by ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	var tpl models.NotificationTemplate
	err := r.db.GetContext(ctx, &tpl,
		`SELECT * FROM notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &tpl, nil
}

// List retrieves notification templates for a tenant with optional filtering and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter models.ListFilter, limit, offset int) ([]models.NotificationTemplate, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Channel != nil && *filter.Channel != "" {
		where += fmt.Sprintf(" AND channel = $%d", argIdx)
		args = append(args, *filter.Channel)
		argIdx++
	}
	if filter.Enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", argIdx)
		args = append(args, *filter.Enabled)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM notification_templates %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var templates []models.NotificationTemplate
	err := r.db.SelectContext(ctx, &templates, query, args...)
	return templates, err
}

// Count returns the total number of notification templates for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notification_templates WHERE tenant_id=$1`, tenantID)
	return count, err
}

// Update updates an existing notification template.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.NotificationTemplate, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE notification_templates SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete removes a notification template by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
