/**
 * Monitoring Module Exports
 *
 * TASK-703: Monitoring & Alerting
 */

// Types
export * from './types';

// Repository & Service (Database-backed)
export { MonitoringRepository } from './MonitoringRepository';
export type {
  MonitoringConfig as MonitoringConfigRecord,
  Alert as AlertRecord,
  AlertCorrelation,
  AlertRuleRecord,
  NotificationChannelRecord,
  EscalationPolicyRecord,
  NotificationHistoryRecord,
  CreateMonitoringConfigInput,
  CreateAlertInput,
  UpdateAlertInput,
  CreateAlertRuleInput,
  CreateNotificationChannelInput,
  CreateEscalationPolicyInput,
  CreateNotificationHistoryInput,
} from './MonitoringRepository';
export { MonitoringService, MonitoringServiceError } from './MonitoringService';

// Services
export { MetricCollector } from './MetricCollector';
export { AlertRuleEngine } from './AlertRuleEngine';
export { AlertNotificationService } from './AlertNotificationService';
export { MonitoringDashboard } from './MonitoringDashboard';

// Auxiliary types
export type { MetricRegistration, MetricQuery } from './MetricCollector';
export type { WidgetConfig, TimeWindow } from './MonitoringDashboard';
export type { ListAlertsOptions, PaginatedResult } from './MonitoringService';
