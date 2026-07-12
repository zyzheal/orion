package models

import "time"

// --- Metric ---

type Metric struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"`       // gauge, counter, histogram
	Unit      string    `json:"unit" db:"unit"`
	Labels    string    `json:"labels" db:"labels"`   // JSON string
	Help      string    `json:"help" db:"help"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateMetricRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Unit   string `json:"unit"`
	Labels string `json:"labels"`
	Help   string `json:"help"`
}

type RecordMetricRequest struct {
	Name   string      `json:"name" binding:"required"`
	Value  float64     `json:"value" binding:"required"`
	Labels map[string]string `json:"labels"`
	Timestamp *time.Time `json:"timestamp"`
}

type MetricSeriesPoint struct {
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
	Value     float64   `json:"value" db:"value"`
	Labels    string    `json:"labels" db:"labels"`
}

type MetricSeries struct {
	Name    string              `json:"name"`
	Points  []MetricSeriesPoint `json:"points"`
}

type MetricSummary struct {
	Name        string  `json:"name"`
	Min         float64 `json:"min"`
	Max         float64 `json:"max"`
	Avg         float64 `json:"avg"`
	LastValue   float64 `json:"last_value"`
	SampleCount int     `json:"sample_count"`
}

// --- Alert Rule ---

type AlertRule struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	Name         string    `json:"name" db:"name"`
	Metric       string    `json:"metric" db:"metric"`
	Operator     string    `json:"operator" db:"operator"`      // gt, lt, gte, lte, eq, neq
	Threshold    float64   `json:"threshold" db:"threshold"`
	EvaluationPeriod int   `json:"evaluation_period" db:"evaluation_period"` // seconds
	Severity     string    `json:"severity" db:"severity"`      // critical, warning, info
	Channels     string    `json:"channels" db:"channels"`      // JSON array
	Enabled      bool      `json:"enabled" db:"enabled"`
	Active       bool      `json:"active" db:"active"`          // false = suppressed
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreateRuleRequest struct {
	Name             string `json:"name" binding:"required"`
	Metric           string `json:"metric" binding:"required"`
	Operator         string `json:"operator" binding:"required"`
	Threshold        float64 `json:"threshold"`
	EvaluationPeriod int    `json:"evaluation_period"`
	Severity         string `json:"severity"`
	Channels         string `json:"channels"`
}

type UpdateRuleRequest struct {
	Name             *string  `json:"name"`
	Metric           *string  `json:"metric"`
	Operator         *string  `json:"operator"`
	Threshold        *float64 `json:"threshold"`
	EvaluationPeriod *int     `json:"evaluation_period"`
	Severity         *string  `json:"severity"`
	Channels         *string  `json:"channels"`
}

type ToggleRuleRequest struct {
	Enabled bool `json:"enabled"`
}

type SuppressRuleRequest struct {
	Reason    string `json:"reason"`
	DurationH *int   `json:"duration_hours"`
}

type EvaluateRulesRequest struct {
	RuleIDs []string `json:"rule_ids"`
}

// --- Alert ---

type Alert struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	RuleID     string    `json:"rule_id" db:"rule_id"`
	Status     string    `json:"status" db:"status"`     // firing, acknowledged, resolved, suppressed
	Message    string    `json:"message" db:"message"`
	Value      float64   `json:"value" db:"value"`
	Severity   string    `json:"severity" db:"severity"`
	AckBy      string    `json:"ack_by" db:"ack_by"`
	AckAt      *time.Time `json:"ack_at" db:"ack_at"`
	ResolvedAt *time.Time `json:"resolved_at" db:"resolved_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type AcknowledgeAlertRequest struct {
	Comment string `json:"comment"`
}

type ResolveAlertRequest struct {
	Comment string `json:"comment"`
}

type EscalateAlertRequest struct {
	Comment string `json:"comment"`
}

// --- Notification Channel ---

type NotificationChannel struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"`     // slack, email, webhook, sms, pagerduty
	Config    string    `json:"config" db:"config"` // JSON
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateChannelRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Config string `json:"config" binding:"required"`
}

type ToggleChannelRequest struct {
	Enabled bool `json:"enabled"`
}

// --- Escalation Policy ---

type EscalationPolicy struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Levels    string    `json:"levels" db:"levels"`     // JSON array of escalation levels
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateEscalationPolicyRequest struct {
	Name   string `json:"name" binding:"required"`
	Levels string `json:"levels" binding:"required"` // JSON array
}

// --- Notification History ---

type NotificationRecord struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	AlertID   string    `json:"alert_id" db:"alert_id"`
	ChannelID string    `json:"channel_id" db:"channel_id"`
	Status    string    `json:"status" db:"status"`   // sent, failed
	Message   string    `json:"message" db:"message"`
	SentAt    time.Time `json:"sent_at" db:"sent_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Dashboard Widget ---

type WidgetConfig struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"`        // gauge, chart, table, threshold
	Metric    string    `json:"metric" db:"metric"`
	Config    string    `json:"config" db:"config"`    // JSON
	Position  int       `json:"position" db:"position"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type AddWidgetConfigRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Metric   string `json:"metric"`
	Config   string `json:"config"`
	Position int    `json:"position"`
}

// --- Dashboard aggregated ---

type DashboardSummary struct {
	TotalRules    int `json:"total_rules"`
	ActiveAlerts  int `json:"active_alerts"`
	TotalChannels int `json:"total_channels"`
	TotalWidgets  int `json:"total_widgets"`
	TopMetrics    []struct {
		Name  string  `json:"name"`
		Value float64 `json:"value"`
	} `json:"top_metrics"`
}

type AggregatedMetrics struct {
	Overall    MetricSummary        `json:"overall"`
	BySeverity map[string]SeverityCounts `json:"by_severity"`
	ByRule     []RuleAlertCounts     `json:"by_rule"`
}

type SeverityCounts struct {
	Firing      int `json:"firing"`
	Acknowledged int `json:"acknowledged"`
	Resolved    int `json:"resolved"`
}

type RuleAlertCounts struct {
	RuleName string `json:"rule_name"`
	Active   int    `json:"active"`
}

// --- Anomaly ---

type Anomaly struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Metric      string    `json:"metric" db:"metric"`
	Score       float64   `json:"score" db:"score"`
	Baseline    float64   `json:"baseline" db:"baseline"`
	Actual      float64   `json:"actual" db:"actual"`
	Severity    string    `json:"severity" db:"severity"`
	Description string    `json:"description" db:"description"`
	DetectedAt  time.Time `json:"detected_at" db:"detected_at"`
}

type AnomalySummary struct {
	TotalAnomalies int         `json:"total_anomalies"`
	ByMetric       []struct {
		Metric     string `json:"metric"`
		Count      int    `json:"count"`
		AvgScore   float64 `json:"avg_score"`
	} `json:"by_metric"`
	BySeverity map[string]int `json:"by_severity"`
	Last24h    int `json:"last_24h"`
}

// --- System collect ---

type SystemMetrics struct {
	Timestamp   time.Time `json:"timestamp"`
	Host        string    `json:"host"`
	CPU         float64   `json:"cpu"`
	Memory      float64   `json:"memory"`
	Disk        float64   `json:"disk"`
	Goroutines  int       `json:"goroutines"`
	UptimeSec   float64   `json:"uptime_sec"`
	HTTPReqs    int64     `json:"http_requests"`
	Errors      int64     `json:"errors"`
}

type CollectSystemMetricsRequest struct {
	CPU    *float64 `json:"cpu"`
	Memory *float64 `json:"memory"`
	Disk   *float64 `json:"disk"`
	Host   string   `json:"host"`
}

// --- Health ---

type ServiceHealth struct {
	Status  string    `json:"status"`
	Uptime  time.Time `json:"uptime"`
	Message string    `json:"message"`
}
