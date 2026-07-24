/**
 * TASK-703: Monitoring & Alerting - Type Definitions
 *
 * Data models for metrics collection, alerting rules, notifications,
 * escalation policies, and dashboard data generation.
 */

// ==================== Metric Types ====================

/**
 * Single metric data point
 */
export interface Metric {
  /** Metric unique ID */
  id: string;
  /** Metric name (e.g., "cpu.usage", "http.latency.p99") */
  name: string;
  /** Metric value */
  value: number;
  /** Tags for filtering/grouping */
  tags: Record<string, string>;
  /** Timestamp when the metric was recorded */
  timestamp: Date;
  /** Unit of measurement (e.g., "percent", "ms", "bytes", "count") */
  unit: string;
}

/**
 * Time-series data point within a metric series
 */
export interface DataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Value at this point */
  value: number;
}

/**
 * Aggregated statistics over a time series
 */
export interface MetricAggregation {
  /** Average value */
  avg: number;
  /** Maximum value */
  max: number;
  /** Minimum value */
  min: number;
  /** 99th percentile value */
  p99: number;
  /** 95th percentile value */
  p95: number;
  /** Total count of data points */
  count: number;
  /** Sum of all values */
  sum: number;
}

/**
 * Time-series metric with aggregated statistics
 */
export interface MetricSeries {
  /** Metric name */
  name: string;
  /** Raw data points */
  dataPoints: DataPoint[];
  /** Aggregated statistics */
  aggregation: MetricAggregation;
  /** Tags filter used */
  tags?: Record<string, string>;
  /** Time window start */
  windowStart: Date;
  /** Time window end */
  windowEnd: Date;
}

// ==================== Alert Rule Types ====================

/**
 * Comparison operator for alert conditions
 */
export type AlertCondition = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'rate_of_change';

/**
 * Alert severity level
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Configurable alerting rule
 */
export interface AlertRule {
  /** Rule unique ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Metric name to monitor */
  metric: string;
  /** Comparison condition */
  condition: AlertCondition;
  /** Threshold value to trigger alert */
  threshold: number;
  /** Alert severity when triggered */
  severity: AlertSeverity;
  /** Whether the rule is currently active */
  enabled: boolean;
  /** Cooldown period in milliseconds to prevent alert flooding */
  cooldownMs: number;
  /** Tags filter for metric matching */
  tags?: Record<string, string>;
  /** Rate-of-change percentage (only for rate_of_change condition) */
  rateOfChangePercent?: number;
  /** Description of the rule */
  description?: string;
  /** Time window for evaluating the metric (ms) */
  evaluationWindowMs?: number;
}

// ==================== Alert Types ====================

/**
 * Alert status
 */
export type AlertStatus = 'triggered' | 'acknowledged' | 'resolved' | 'suppressed';

/**
 * Triggered alert instance
 */
export interface Alert {
  /** Alert unique ID */
  id: string;
  /** ID of the rule that triggered this alert */
  ruleId: string;
  /** Rule name */
  ruleName?: string;
  /** Metric name that exceeded threshold */
  metric: string;
  /** Current metric value */
  value: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Severity level */
  severity: AlertSeverity;
  /** Current alert status */
  status: AlertStatus;
  /** When the alert was first triggered */
  triggeredAt: Date;
  /** When the alert was acknowledged (null if not yet) */
  acknowledgedAt?: Date;
  /** Who acknowledged the alert */
  acknowledgedBy?: string;
  /** When the alert was resolved */
  resolvedAt?: Date;
  /** Alert tags (from metric + rule) */
  tags?: Record<string, string>;
  /** Alert message */
  message?: string;
  /** Tenant ID */
  tenantId: string;
}

// ==================== Alert Channel Types ====================

/**
 * Notification channel type
 */
export type ChannelType = 'email' | 'webhook' | 'slack';

/**
 * Email channel configuration
 */
export interface EmailChannelConfig {
  /** Recipient email addresses */
  recipients: string[];
  /** Email subject prefix */
  subjectPrefix?: string;
  /** SMTP server (optional, uses default) */
  smtpServer?: string;
}

/**
 * Webhook channel configuration
 */
export interface WebhookChannelConfig {
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method?: 'POST' | 'PUT' | 'PATCH';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Slack channel configuration
 */
export interface SlackChannelConfig {
  /** Slack webhook URL */
  webhookUrl: string;
  /** Slack channel name */
  channel?: string;
  /** Username for the message */
  username?: string;
  /** Icon emoji */
  iconEmoji?: string;
}

/**
 * Union type for channel configs
 */
export type ChannelConfig = EmailChannelConfig | WebhookChannelConfig | SlackChannelConfig;

/**
 * Alert notification channel
 */
export interface AlertChannel {
  /** Channel unique ID */
  id: string;
  /** Channel type */
  type: ChannelType;
  /** Channel-specific configuration */
  config: ChannelConfig;
  /** Whether the channel is currently active */
  enabled: boolean;
  /** Channel display name */
  name: string;
  /** Filter by severity (if specified, only these severities are sent) */
  severityFilter?: AlertSeverity[];
}

// ==================== Escalation Policy Types ====================

/**
 * Escalation step
 */
export interface EscalationStep {
  /** Step order (0-based) */
  step: number;
  /** Time to wait before this step (in milliseconds) */
  waitMs: number;
  /** Recipients to notify at this step */
  recipients: string[];
  /** Channel IDs to use */
  channelIds: string[];
}

/**
 * Escalation policy for alert notifications
 */
export interface EscalationPolicy {
  /** Policy unique ID */
  id: string;
  /** Policy name */
  name: string;
  /** Escalation steps in order */
  steps: EscalationStep[];
  /** How many times to repeat the entire escalation cycle */
  repeatCount: number;
  /** Whether the policy is active */
  enabled: boolean;
  /** Description */
  description?: string;
}

// ==================== Notification History Types ====================

/**
 * Notification delivery status
 */
export type NotificationStatus = 'sent' | 'failed' | 'pending' | 'escalated';

/**
 * Notification record
 */
export interface NotificationRecord {
  /** Record unique ID */
  id: string;
  /** Associated alert ID */
  alertId: string;
  /** Channel ID used */
  channelId: string;
  /** Channel type */
  channelType: ChannelType;
  /** Delivery status */
  status: NotificationStatus;
  /** When the notification was sent */
  sentAt: Date;
  /** Error message if delivery failed */
  errorMessage?: string;
  /** Response payload from the channel */
  responsePayload?: string;
  /** Escalation step number (if part of escalation) */
  escalationStep?: number;
}

// ==================== Dashboard Types ====================

/**
 * Dashboard metric widget data
 */
export interface DashboardWidget {
  /** Widget title */
  title: string;
  /** Metric name(s) */
  metrics: string[];
  /** Time-series data */
  series: MetricSeries[];
  /** Current aggregated value */
  currentValue?: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Anomaly flag */
  hasAnomaly?: boolean;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  /** Metric name */
  metric: string;
  /** Timestamp of the anomaly */
  timestamp: Date;
  /** Actual value */
  value: number;
  /** Expected value (mean) */
  expectedValue: number;
  /** Z-score */
  zScore: number;
  /** Whether this is considered anomalous */
  isAnomaly: boolean;
}

/**
 * Dashboard data aggregation
 */
export interface DashboardData {
  /** Widgets data */
  widgets: DashboardWidget[];
  /** Overall system health score (0-100) */
  healthScore: number;
  /** Active alerts count by severity */
  activeAlerts: Record<AlertSeverity, number>;
  /** Anomaly summary */
  anomalies: AnomalyResult[];
  /** Generated at */
  generatedAt: Date;
}

// ==================== Monitoring Config ====================

/**
 * Monitoring service configuration
 */
export interface MonitoringConfig {
  /** Metric collection interval in milliseconds */
  collectionIntervalMs: number;
  /** Alert evaluation interval in milliseconds */
  evaluationIntervalMs: number;
  /** Metric retention period in milliseconds */
  retentionMs: number;
  /** Maximum data points per metric series */
  maxDataPointsPerMetric: number;
  /** Anomaly detection z-score threshold */
  anomalyZScoreThreshold: number;
  /** Whether to enable system metrics collection */
  enableSystemMetrics: boolean;
  /** NATS subject prefix for monitoring events */
  natsSubjectPrefix: string;
}
