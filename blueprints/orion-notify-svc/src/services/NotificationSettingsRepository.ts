import type { DatabasePool } from '../utils/database';
import type { NotificationSettings, CreateNotificationSettingsInput } from '../types/notification';

export class NotificationSettingsRepository {
  constructor(private pool: DatabasePool) {}

  async findByUser(userId: string, tenantId: string): Promise<NotificationSettings | null> {
    const result = await this.pool.query(
      'SELECT * FROM notification_settings WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async upsert(input: CreateNotificationSettingsInput): Promise<NotificationSettings> {
    const result = await this.pool.query(
      `INSERT INTO notification_settings (
        user_id, tenant_id, email_enabled, sms_enabled, webhook_enabled, webhook_url,
        pipeline_completed, pipeline_failed, ticket_assigned, ticket_escalated,
        sla_warning, sla_breached, alert_triggered, deployment_succeed, deployment_failed,
        system_alert, comment_mention, transfer_request, digest_enabled, digest_frequency,
        quiet_hours_start, quiet_hours_end
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
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
        updated_at = NOW()
      RETURNING *`,
      [
        input.user_id, input.tenant_id,
        input.email_enabled ?? true, input.sms_enabled ?? false,
        input.webhook_enabled ?? false, input.webhook_url ?? null,
        input.pipeline_completed ?? true, input.pipeline_failed ?? true,
        input.ticket_assigned ?? true, input.ticket_escalated ?? true,
        input.sla_warning ?? true, input.sla_breached ?? true,
        input.alert_triggered ?? true, input.deployment_succeed ?? true,
        input.deployment_failed ?? true, input.system_alert ?? true,
        input.comment_mention ?? true, input.transfer_request ?? true,
        input.digest_enabled ?? false, input.digest_frequency ?? 'daily',
        input.quiet_hours_start ?? null, input.quiet_hours_end ?? null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): NotificationSettings {
    return {
      id: row.id,
      user_id: row.user_id,
      tenant_id: row.tenant_id,
      email_enabled: row.email_enabled,
      sms_enabled: row.sms_enabled,
      webhook_enabled: row.webhook_enabled,
      webhook_url: row.webhook_url,
      pipeline_completed: row.pipeline_completed,
      pipeline_failed: row.pipeline_failed,
      ticket_assigned: row.ticket_assigned,
      ticket_escalated: row.ticket_escalated,
      sla_warning: row.sla_warning,
      sla_breached: row.sla_breached,
      alert_triggered: row.alert_triggered,
      deployment_succeed: row.deployment_succeed,
      deployment_failed: row.deployment_failed,
      system_alert: row.system_alert,
      comment_mention: row.comment_mention,
      transfer_request: row.transfer_request,
      digest_enabled: row.digest_enabled,
      digest_frequency: row.digest_frequency,
      quiet_hours_start: row.quiet_hours_start,
      quiet_hours_end: row.quiet_hours_end,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
