export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
}

export interface CreateNotificationInput {
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  tenant_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  webhook_enabled: boolean;
  webhook_url: string | null;
  pipeline_completed: boolean;
  pipeline_failed: boolean;
  ticket_assigned: boolean;
  ticket_escalated: boolean;
  sla_warning: boolean;
  sla_breached: boolean;
  alert_triggered: boolean;
  deployment_succeed: boolean;
  deployment_failed: boolean;
  system_alert: boolean;
  comment_mention: boolean;
  transfer_request: boolean;
  digest_enabled: boolean;
  digest_frequency: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationSettingsInput {
  user_id: string;
  tenant_id: string;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  webhook_enabled?: boolean;
  webhook_url?: string;
  pipeline_completed?: boolean;
  pipeline_failed?: boolean;
  ticket_assigned?: boolean;
  ticket_escalated?: boolean;
  sla_warning?: boolean;
  sla_breached?: boolean;
  alert_triggered?: boolean;
  deployment_succeed?: boolean;
  deployment_failed?: boolean;
  system_alert?: boolean;
  comment_mention?: boolean;
  transfer_request?: boolean;
  digest_enabled?: boolean;
  digest_frequency?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}
