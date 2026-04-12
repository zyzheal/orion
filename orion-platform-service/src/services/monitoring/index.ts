/**
 * Monitoring Module Exports
 *
 * TASK-703: Monitoring & Alerting
 */

// Types
export * from './types';

// Services
export { MetricCollector } from './MetricCollector';
export { AlertRuleEngine } from './AlertRuleEngine';
export { AlertNotificationService } from './AlertNotificationService';
export { MonitoringDashboard } from './MonitoringDashboard';
export { MonitoringService } from './MonitoringService';

// Auxiliary types
export type { MetricRegistration, MetricQuery } from './MetricCollector';
export type { WidgetConfig, TimeWindow } from './MonitoringDashboard';
export type { MonitoringEventType } from './MonitoringService';
