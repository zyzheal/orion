package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/notification/notification/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all notification entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Notification CRUD ----

// CreateNotification inserts a new notification record.
func (r *Repository) CreateNotification(ctx context.Context, n *models.Notification) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notifications (id, tenant_id, user_id, type, title, channel, recipient, subject, body, status, metadata, sent_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		n.ID, n.TenantID, n.UserID, n.Type, n.Title, n.Channel, n.Recipient, n.Subject, n.Body, n.Status, n.Metadata, n.SentAt,
	)
	return err
}

// ListNotifications returns notifications with optional filters.
func (r *Repository) ListNotifications(ctx context.Context, tenantID string, opts models.ListNotificationsQuery) ([]models.Notification, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id=$%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if opts.UserID != "" {
		conditions = append(conditions, fmt.Sprintf("user_id=$%d", argIdx))
		args = append(args, opts.UserID)
		argIdx++
	}
	if opts.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, opts.Status)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM notifications WHERE %s", where)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Fetch page
	offset := opts.Offset()
	limit := opts.Limit()
	args = append(args, offset, limit)
	query := fmt.Sprintf("SELECT * FROM notifications WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d", where, argIdx, argIdx+1)

	var items []models.Notification
	if err := r.db.SelectContext(ctx, &items, query, args...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetNotification returns a single notification by id and tenant.
func (r *Repository) GetNotification(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n, `SELECT * FROM notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// UpdateNotification updates an existing notification.
func (r *Repository) UpdateNotification(ctx context.Context, n *models.Notification) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET channel=$1, recipient=$2, subject=$3, body=$4, status=$5, metadata=$6, read_at=$7, sent_at=$8
		 WHERE id=$9 AND tenant_id=$10`,
		n.Channel, n.Recipient, n.Subject, n.Body, n.Status, n.Metadata, n.ReadAt, n.SentAt, n.ID, n.TenantID,
	)
	return err
}

// MarkAsRead sets status='read' and read_at=now().
func (r *Repository) MarkAsRead(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`UPDATE notifications SET status='read', read_at=NOW()
		 WHERE id=$1 AND tenant_id=$2 RETURNING *`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// MarkAsSent sets status='sent' and sent_at=now().
func (r *Repository) MarkAsSent(ctx context.Context, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`UPDATE notifications SET status='sent', sent_at=NOW()
		 WHERE id=$1 RETURNING *`, id,
	)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// GetUnreadCount returns the count of notifications with status='sent' (unread).
func (r *Repository) GetUnreadCount(ctx context.Context, tenantID, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND user_id=$2 AND status='sent'`,
		tenantID, userID,
	)
	return count, err
}

// DeleteNotification soft-deletes or removes a notification.
func (r *Repository) DeleteNotification(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// CountNotifications returns total notification count for a tenant.
func (r *Repository) CountNotifications(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM notifications WHERE tenant_id=$1`, tenantID)
	return count, err
}

// NotificationStatsCount returns the notification stats for a tenant.
func (r *Repository) NotificationStatsCount(ctx context.Context, tenantID string) (*models.NotificationStats, error) {
	s := &models.NotificationStats{}
	if err := r.db.GetContext(ctx, &s.Total,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1`, tenantID); err != nil {
		return nil, err
	}
	if err := r.db.GetContext(ctx, &s.Pending,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status=$2`, tenantID, models.StatusPending); err != nil {
		return nil, err
	}
	if err := r.db.GetContext(ctx, &s.Sent,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status=$2`, tenantID, models.StatusSent); err != nil {
		return nil, err
	}
	if err := r.db.GetContext(ctx, &s.Failed,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status=$2`, tenantID, models.StatusFailed); err != nil {
		return nil, err
	}
	if err := r.db.GetContext(ctx, &s.Read,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status=$2`, tenantID, models.StatusRead); err != nil {
		return nil, err
	}
	s.UnreadCount = s.Sent // sent but not marked read
	return s, nil
}

// ---- Template CRUD ----

// CreateTemplate inserts a new notification template.
func (r *Repository) CreateTemplate(ctx context.Context, t *models.NotificationTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_templates (id, tenant_id, name, channel, subject, body)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		t.ID, t.TenantID, t.Name, t.Channel, t.Subject, t.Body,
	)
	return err
}

// ListTemplates returns all templates for a tenant.
func (r *Repository) ListTemplates(ctx context.Context, tenantID string) ([]models.NotificationTemplate, error) {
	var items []models.NotificationTemplate
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID,
	)
	return items, err
}

// GetTemplate returns a single template by id.
func (r *Repository) GetTemplate(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	var t models.NotificationTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// DeleteTemplate removes a template.
func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

// UpdateTemplate updates an existing notification template.
func (r *Repository) UpdateTemplate(ctx context.Context, tenantID, id string, t *models.NotificationTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notification_templates SET name=$1, channel=$2, subject=$3, body=$4 WHERE id=$5 AND tenant_id=$6`,
		t.Name, t.Channel, t.Subject, t.Body, id, tenantID,
	)
	return err
}

// ---- Channel CRUD ----

// CreateChannel inserts a new notification channel configuration.
func (r *Repository) CreateChannel(ctx context.Context, c *models.NotificationChannel) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_channels (id, tenant_id, name, type, config, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.TenantID, c.Name, c.Type, c.Config, c.Enabled,
	)
	return err
}

// ListChannels returns all channel configs for a tenant.
func (r *Repository) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	var items []models.NotificationChannel
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_channels WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID,
	)
	return items, err
}

// GetChannel returns a single channel config by id.
func (r *Repository) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	var c models.NotificationChannel
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM notification_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetEnabledChannels returns all enabled channels for a tenant.
func (r *Repository) GetEnabledChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	var items []models.NotificationChannel
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_channels WHERE tenant_id=$1 AND enabled=true ORDER BY created_at DESC`, tenantID,
	)
	return items, err
}

// UpdateChannel updates an existing channel configuration.
func (r *Repository) UpdateChannel(ctx context.Context, c *models.NotificationChannel) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notification_channels SET name=$1, type=$2, config=$3, enabled=$4
		 WHERE id=$5 AND tenant_id=$6`,
		c.Name, c.Type, c.Config, c.Enabled, c.ID, c.TenantID,
	)
	return err
}

// DeleteChannel removes a channel configuration.
func (r *Repository) DeleteChannel(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

// ---- Settings ----

// GetSettings returns notification settings for a user, or nil if none exist.
func (r *Repository) GetSettings(ctx context.Context, tenantID, userID string) (*models.NotificationSettings, error) {
	var s models.NotificationSettings
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM notification_settings WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// UpsertSettings creates or updates notification settings using ON CONFLICT.
func (r *Repository) UpsertSettings(ctx context.Context, s *models.NotificationSettings) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_settings (
			id, user_id, tenant_id, email_enabled, slack_enabled, webhook_enabled, webhook_url,
			pipeline_completed, pipeline_failed, ticket_assigned, ticket_escalated,
			sla_warning, sla_breached, alert_triggered, deployment_success, deployment_failed,
			system_alert, comment_mention, transfer_request, digest_enabled, digest_frequency,
			quiet_hours_start, quiet_hours_end
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
		)
		ON CONFLICT (user_id, tenant_id) DO UPDATE SET
			email_enabled=$4, slack_enabled=$5, webhook_enabled=$6, webhook_url=$7,
			pipeline_completed=$8, pipeline_failed=$9, ticket_assigned=$10, ticket_escalated=$11,
			sla_warning=$12, sla_breached=$13, alert_triggered=$14, deployment_success=$15,
			deployment_failed=$16, system_alert=$17, comment_mention=$18, transfer_request=$19,
			digest_enabled=$20, digest_frequency=$21, quiet_hours_start=$22, quiet_hours_end=$23,
			updated_at=NOW()`,
		s.ID, s.UserID, s.TenantID, s.EmailEnabled, s.SlackEnabled, s.WebhookEnabled, s.WebhookURL,
		s.PipelineCompleted, s.PipelineFailed, s.TicketAssigned, s.TicketEscalated,
		s.SLAWarning, s.SLABreached, s.AlertTriggered, s.DeploymentSuccess, s.DeploymentFailed,
		s.SystemAlert, s.CommentMention, s.TransferRequest, s.DigestEnabled, s.DigestFrequency,
		s.QuietHoursStart, s.QuietHoursEnd,
	)
	return err
}

// ---- Subscriptions ----

// GetSubscriptions returns all subscriptions for a user.
func (r *Repository) GetSubscriptions(ctx context.Context, tenantID, userID string) ([]models.NotificationSubscription, error) {
	var items []models.NotificationSubscription
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_subscriptions WHERE tenant_id=$1 AND user_id=$2 ORDER BY channel`, tenantID, userID,
	)
	return items, err
}

// UpsertSubscription creates or updates a channel subscription.
func (r *Repository) UpsertSubscription(ctx context.Context, s *models.NotificationSubscription) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_subscriptions (id, tenant_id, user_id, channel, enabled)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (tenant_id, user_id, channel) DO UPDATE SET enabled=$5, updated_at=NOW()`,
		s.ID, s.TenantID, s.UserID, s.Channel, s.Enabled,
	)
	return err
}

// DeleteSubscription removes a channel subscription.
func (r *Repository) DeleteSubscription(ctx context.Context, tenantID, userID, channel string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_subscriptions WHERE tenant_id=$1 AND user_id=$2 AND channel=$3`,
		tenantID, userID, channel,
	)
	return err
}
