package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/webhook/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// sentinel.NotFound is returned when a requested webhook or delivery is not found.

// Repository provides CRUD operations for webhooks and deliveries.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Webhook CRUD ---

// Create inserts a new webhook record.
func (r *Repository) Create(ctx context.Context, w *models.Webhook) error {
	w.ID = uuid.New().String()
	now := time.Now().UTC()
	w.CreatedAt = now
	w.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO webhooks (id, tenant_id, user_id, name, url, method, event_type, secret, headers, body_template, enabled, max_retries, retry_interval, timeout, last_triggered_at, last_delivery_status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :user_id, :name, :url, :method, :event_type, :secret, :headers, :body_template, :enabled, :max_retries, :retry_interval, :timeout, :last_triggered_at, :last_delivery_status, :created_at, :updated_at)`,
		w)
	return err
}

// GetByID retrieves a webhook by its ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.Webhook, error) {
	var w models.Webhook
	err := r.db.GetContext(ctx, &w,
		`SELECT * FROM webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &w, nil
}

// List returns webhooks for a tenant, with optional filtering and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, limit, offset int) ([]models.Webhook, error) {
	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if filter != nil {
		if filter.EventType != nil {
			where.WriteString(fmt.Sprintf(" AND event_type = $%d", argIdx))
			args = append(args, *filter.EventType)
			argIdx++
		}
		if filter.Enabled != nil {
			where.WriteString(fmt.Sprintf(" AND enabled = $%d", argIdx))
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	query := fmt.Sprintf(`SELECT * FROM webhooks %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where.String(), argIdx, argIdx+1)
	args = append(args, limit, offset)

	var webhooks []models.Webhook
	err := r.db.SelectContext(ctx, &webhooks, query, args...)
	return webhooks, err
}

// Count returns the total number of webhooks for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM webhooks WHERE tenant_id=$1`, tenantID)
	return count, err
}

// Update applies partial updates to a webhook by ID.
func (r *Repository) Update(ctx context.Context, w *models.Webhook) error {
	w.UpdatedAt = time.Now().UTC()

	// Track which fields are set via the update request.
	// We build a dynamic UPDATE using the values that are non-zero.
	// Since the caller passes a full Webhook struct with only changed fields,
	// we use a map-based approach similar to the backup module.
	updates := map[string]interface{}{}
	if w.Name != "" {
		updates["name"] = w.Name
	}
	if w.URL != "" {
		updates["url"] = w.URL
	}
	if w.Method != "" {
		updates["method"] = w.Method
	}
	if w.EventType != "" {
		updates["event_type"] = w.EventType
	}
	if w.Secret != "" {
		updates["secret"] = w.Secret
	}
	if w.Headers != "" {
		updates["headers"] = w.Headers
	}
	if w.BodyTemplate != "" {
		updates["body_template"] = w.BodyTemplate
	}
	updates["enabled"] = w.Enabled
	updates["max_retries"] = w.MaxRetries
	updates["retry_interval"] = w.RetryInterval
	updates["timeout"] = w.Timeout
	if w.LastDeliveryStatus != "" {
		updates["last_delivery_status"] = w.LastDeliveryStatus
	}
	if w.LastTriggeredAt != nil {
		updates["last_triggered_at"] = w.LastTriggeredAt
	}
	updates["updated_at"] = w.UpdatedAt

	if len(updates) == 0 {
		return sentinel.NotFound
	}

	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, w.ID, w.TenantID)
	query := fmt.Sprintf(`UPDATE webhooks SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// Delete removes a webhook by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, id, tenantID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM webhooks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- Delivery CRUD ---

// CreateDelivery inserts a new delivery record.
func (r *Repository) CreateDelivery(ctx context.Context, d *models.WebhookDelivery) error {
	d.ID = uuid.New().String()
	d.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO webhook_deliveries (id, webhook_id, url, status, http_status, response_body, error_message, attempt, retry_after, created_at, triggered_at, completed_at)
		 VALUES (:id, :webhook_id, :url, :status, :http_status, :response_body, :error_message, :attempt, :retry_after, :created_at, :triggered_at, :completed_at)`,
		d)
	return err
}

// ListByWebhook returns deliveries for a webhook, ordered by creation time descending.
func (r *Repository) ListByWebhook(ctx context.Context, tenantID, webhookID string, limit, offset int) ([]models.WebhookDelivery, error) {
	var deliveries []models.WebhookDelivery
	err := r.db.SelectContext(ctx, &deliveries,
		`SELECT d.* FROM webhook_deliveries d
		 INNER JOIN webhooks w ON w.id = d.webhook_id
		 WHERE w.tenant_id=$1 AND d.webhook_id=$2
		 ORDER BY d.created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, webhookID, limit, offset)
	return deliveries, err
}
