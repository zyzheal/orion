package repository

import (
	"context"

	"orion/notify-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// SettingsRepository provides access to the notification_settings table.
// Ported from orion-platform-service NotificationSettingsRepository.ts
type SettingsRepository struct {
	db *sqlx.DB
}

func NewSettingsRepository(db *sqlx.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

// FindByUser returns the notification settings for a specific user and tenant.
func (r *SettingsRepository) FindByUser(ctx context.Context, userID, tenantID string) (*models.NotificationSettings, error) {
	var s models.NotificationSettings
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM notification_settings WHERE user_id = $1 AND tenant_id = $2`,
		userID, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// Upsert inserts or updates notification settings using ON CONFLICT on (user_id, tenant_id).
// All fields are provided with defaults from the service layer.
func (r *SettingsRepository) Upsert(ctx context.Context, s *models.NotificationSettings) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_settings (
			user_id, tenant_id,
			email_enabled, sms_enabled, webhook_enabled, webhook_url,
			pipeline_completed, pipeline_failed, ticket_assigned, ticket_escalated,
			sla_warning, sla_breached, alert_triggered, deployment_succeed, deployment_failed,
			system_alert, comment_mention, transfer_request,
			digest_enabled, digest_frequency,
			quiet_hours_start, quiet_hours_end
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
		)
		ON CONFLICT (user_id, tenant_id)
		DO UPDATE SET
			email_enabled = EXCLUDED.email_enabled,
			sms_enabled = EXCLUDED.sms_enabled,
			webhook_enabled = EXCLUDED.webhook_enabled,
			webhook_url = EXCLUDED.webhook_url,
			pipeline_completed = EXCLUDED.pipeline_completed,
			pipeline_failed = EXCLUDED.pipeline_failed,
			ticket_assigned = EXCLUDED.ticket_assigned,
			ticket_escalated = EXCLUDED.ticket_escalated,
			sla_warning = EXCLUDED.sla_warning,
			sla_breached = EXCLUDED.sla_breached,
			alert_triggered = EXCLUDED.alert_triggered,
			deployment_succeed = EXCLUDED.deployment_succeed,
			deployment_failed = EXCLUDED.deployment_failed,
			system_alert = EXCLUDED.system_alert,
			comment_mention = EXCLUDED.comment_mention,
			transfer_request = EXCLUDED.transfer_request,
			digest_enabled = EXCLUDED.digest_enabled,
			digest_frequency = EXCLUDED.digest_frequency,
			quiet_hours_start = EXCLUDED.quiet_hours_start,
			quiet_hours_end = EXCLUDED.quiet_hours_end,
			updated_at = NOW()`,
		s.UserID, s.TenantID,
		s.EmailEnabled, s.SmsEnabled, s.WebhookEnabled, s.WebhookURL,
		s.PipelineCompleted, s.PipelineFailed, s.TicketAssigned, s.TicketEscalated,
		s.SlaWarning, s.SlaBreached, s.AlertTriggered, s.DeploymentSucceed, s.DeploymentFailed,
		s.SystemAlert, s.CommentMention, s.TransferRequest,
		s.DigestEnabled, s.DigestFrequency,
		s.QuietHoursStart, s.QuietHoursEnd)
	return err
}
