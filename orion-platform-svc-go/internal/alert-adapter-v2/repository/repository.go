// Package repository provides data access for the Alert Adapter V2 notification service.
//
// All queries enforce tenant_id isolation — no query is executed without a
// tenant filter. Uses sqlx with named parameters.
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-adapter-v2/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Errors.
var (
	ErrAdapterNotFound     = errors.New("notification adapter not found")
	ErrEventNotFound       = errors.New("notification event not found")
	ErrTemplateNotFound    = errors.New("notification template not found")
)

// Repository is the data access layer for notification adapters, templates, and events.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===================================================================
// Adapter CRUD
// ===================================================================

// CreateAdapter inserts a new notification adapter.
func (r *Repository) CreateAdapter(ctx context.Context, adapter *models.AlertNotificationAdapter) error {
	adapter.ID = uuid.New().String()
	now := sql.NullTime{Time: nowUTC(), Valid: true}
	query := `INSERT INTO alert_notification_adapters (id, tenant_id, name, channel, config, status, error, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :channel, :config, :status, :error, :enabled, :created_at, :updated_at)`
	ca := &createAdapterRow{
		ID:        adapter.ID,
		TenantID:  adapter.TenantID,
		Name:      adapter.Name,
		Channel:   adapter.Channel,
		Config:    adapter.Config,
		Status:    adapter.Status,
		Error:     adapter.Error,
		Enabled:   adapter.Enabled,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, err := r.db.NamedExecContext(ctx, query, ca)
	return err
}

type createAdapterRow struct {
	ID        string     `db:"id"`
	TenantID  string     `db:"tenant_id"`
	Name      string     `db:"name"`
	Channel   string     `db:"channel"`
	Config    string     `db:"config"`
	Status    string     `db:"status"`
	Error     string     `db:"error"`
	Enabled   bool       `db:"enabled"`
	CreatedAt sql.NullTime `db:"created_at"`
	UpdatedAt sql.NullTime `db:"updated_at"`
}

// GetAdapterByID retrieves an adapter by ID.
func (r *Repository) GetAdapterByID(ctx context.Context, id string) (*models.AlertNotificationAdapter, error) {
	var a models.AlertNotificationAdapter
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM alert_notification_adapters WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAdapters returns adapters for a tenant, optionally filtered by channel.
func (r *Repository) ListAdapters(ctx context.Context, tenantID, channel string, offset, limit int) ([]models.AlertNotificationAdapter, error) {
	if limit <= 0 {
		limit = 20
	}
	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if channel != "" {
		cond += fmt.Sprintf(" AND channel=$%d", len(args)+1)
		args = append(args, channel)
	}
	sql := fmt.Sprintf("SELECT * FROM alert_notification_adapters %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		cond, len(args)+1, len(args)+2)
	args = append(args, limit, offset)
	var items []models.AlertNotificationAdapter
	return items, r.db.SelectContext(ctx, &items, sql, args...)
}

// UpdateAdapter updates an adapter. Pass nil pointers for fields to leave unchanged.
func (r *Repository) UpdateAdapter(ctx context.Context, tenantID, id string, req *models.UpdateAdapterRequest) (*models.AlertNotificationAdapter, error) {
	// Load existing
	existing, err := r.GetAdapterByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing.TenantID != tenantID {
		return nil, ErrAdapterNotFound
	}

	updates := []string{"updated_at = NOW()"}
	args := []interface{}{id}
	argIdx := 2

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name=$%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Channel != nil {
		updates = append(updates, fmt.Sprintf("channel=$%d", argIdx))
		args = append(args, *req.Channel)
		argIdx++
	}
	if req.Config != nil {
		updates = append(updates, fmt.Sprintf("config=$%d", argIdx))
		args = append(args, *req.Config)
		argIdx++
	}
	if req.Enabled != nil {
		updates = append(updates, fmt.Sprintf("enabled=$%d", argIdx))
		args = append(args, *req.Enabled)
		argIdx++
	}
	if req.Status != nil {
		updates = append(updates, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}

	sql := fmt.Sprintf("UPDATE alert_notification_adapters SET %s WHERE id=$1 RETURNING *",
		joinComma(updates))
	var a models.AlertNotificationAdapter
	return &a, r.db.GetContext(ctx, &a, sql, args...)
}

// DeleteAdapter soft-deletes an adapter by disabling it.
func (r *Repository) DeleteAdapter(ctx context.Context, tenantID, id string) error {
	existing, err := r.GetAdapterByID(ctx, id)
	if err != nil {
		return err
	}
	if existing.TenantID != tenantID {
		return ErrAdapterNotFound
	}
	_, err = r.db.ExecContext(ctx,
		`UPDATE alert_notification_adapters SET enabled=false, status='disabled', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

// ===================================================================
// Event CRUD
// ===================================================================

// CreateEvent inserts a new notification delivery event.
func (r *Repository) CreateEvent(ctx context.Context, event *models.AlertNotificationEvent) error {
	event.ID = uuid.New().String()
	if event.Payload == "" {
		event.Payload = "{}"
	}
	if event.Status == "" {
		event.Status = "queued"
	}
	now := sql.NullTime{Time: nowUTC(), Valid: true}
	sentAt := sql.NullTime{Time: event.SentAt.UTC(), Valid: event.SentAt != nil}
	deliveredAt := sql.NullTime{Time: event.DeliveredAt.UTC(), Valid: event.DeliveredAt != nil}
	query := `INSERT INTO alert_notification_events (id, tenant_id, adapter_id, alert_id, payload, status, error, sent_at, delivered_at, created_at)
		VALUES (:id, :tenant_id, :adapter_id, :alert_id, :payload, :status, :error, :sent_at, :delivered_at, :created_at)`
	e := &createEventRow{
		ID:          event.ID,
		TenantID:    event.TenantID,
		AdapterID:   event.AdapterID,
		AlertID:     event.AlertID,
		Payload:     event.Payload,
		Status:      event.Status,
		Error:       event.Error,
		SentAt:      sentAt,
		DeliveredAt: deliveredAt,
		CreatedAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx, query, e)
	return err
}

type createEventRow struct {
	ID          string      `db:"id"`
	TenantID    string      `db:"tenant_id"`
	AdapterID   string      `db:"adapter_id"`
	AlertID     string      `db:"alert_id"`
	Payload     string      `db:"payload"`
	Status      string      `db:"status"`
	Error       string      `db:"error"`
	SentAt      sql.NullTime `db:"sent_at"`
	DeliveredAt sql.NullTime `db:"delivered_at"`
	CreatedAt   sql.NullTime `db:"created_at"`
}

// ListEventsByAdapter returns delivery events for an adapter (tenant-scoped).
func (r *Repository) ListEventsByAdapter(ctx context.Context, tenantID, adapterID, status string, offset, limit int) ([]models.AlertNotificationEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	cond := "WHERE tenant_id=$1 AND adapter_id=$2"
	args := []interface{}{tenantID, adapterID}
	if status != "" {
		cond += fmt.Sprintf(" AND status=$%d", len(args)+1)
		args = append(args, status)
	}
	sql := fmt.Sprintf("SELECT * FROM alert_notification_events %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		cond, len(args)+1, len(args)+2)
	args = append(args, limit, offset)
	var items []models.AlertNotificationEvent
	return items, r.db.SelectContext(ctx, &items, sql, args...)
}

// MarkEventSent updates an event's status to "sent" with a sent_at timestamp.
func (r *Repository) MarkEventSent(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_notification_events SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`, id)
	return err
}

// MarkEventDelivered updates an event's status to "delivered" with a delivered_at timestamp.
func (r *Repository) MarkEventDelivered(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_notification_events SET status='delivered', delivered_at=NOW(), sent_at=COALESCE(sent_at, NOW()), updated_at=NOW() WHERE id=$1`, id)
	return err
}

// MarkEventFailed updates an event's status to "failed" with an error message.
func (r *Repository) MarkEventFailed(ctx context.Context, id, errMsg string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_notification_events SET status='failed', error=$2, updated_at=NOW() WHERE id=$1`, id, errMsg)
	return err
}

// ===================================================================
// Template CRUD
// ===================================================================

// CreateTemplate inserts a new notification template.
func (r *Repository) CreateTemplate(ctx context.Context, template *models.AlertNotificationTemplate) error {
	template.ID = uuid.New().String()
	now := sql.NullTime{Time: nowUTC(), Valid: true}
	query := `INSERT INTO alert_notification_templates (id, tenant_id, name, channel, template, variables, created_at)
		VALUES (:id, :tenant_id, :name, :channel, :template, :variables, :created_at)`
	ct := &createTemplateRow{
		ID:        template.ID,
		TenantID:  template.TenantID,
		Name:      template.Name,
		Channel:   template.Channel,
		Template:  template.Template,
		Variables: template.Variables,
		CreatedAt: now,
	}
	_, err := r.db.NamedExecContext(ctx, query, ct)
	return err
}

type createTemplateRow struct {
	ID        string      `db:"id"`
	TenantID  string      `db:"tenant_id"`
	Name      string      `db:"name"`
	Channel   string      `db:"channel"`
	Template  string      `db:"template"`
	Variables string      `db:"variables"`
	CreatedAt sql.NullTime `db:"created_at"`
}

// GetTemplateByID retrieves a template by ID.
func (r *Repository) GetTemplateByID(ctx context.Context, tenantID, id string) (*models.AlertNotificationTemplate, error) {
	var t models.AlertNotificationTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM alert_notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTemplates returns templates for a tenant, optionally filtered by channel.
func (r *Repository) ListTemplates(ctx context.Context, tenantID, channel string, offset, limit int) ([]models.AlertNotificationTemplate, error) {
	if limit <= 0 {
		limit = 20
	}
	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if channel != "" {
		cond += fmt.Sprintf(" AND channel=$%d", len(args)+1)
		args = append(args, channel)
	}
	sql := fmt.Sprintf("SELECT * FROM alert_notification_templates %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		cond, len(args)+1, len(args)+2)
	args = append(args, limit, offset)
	var items []models.AlertNotificationTemplate
	return items, r.db.SelectContext(ctx, &items, sql, args...)
}

// DeleteTemplate deletes a template (tenant-scoped).
func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM alert_notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ===================================================================
// Helpers
// ===================================================================

func nowUTC() time.Time {
	return time.Now().UTC()
}

func joinComma(s []string) string {
	if len(s) == 0 {
		return ""
	}
	result := s[0]
	for _, v := range s[1:] {
		result += ", " + v
	}
	return result
}
