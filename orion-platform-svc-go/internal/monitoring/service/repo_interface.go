package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
)

// MonitoringRepo is the interface required by Service. It contains exactly the
// methods called on the concrete repository.Repository, extracted from the
// service's actual usage to allow unit testing without a database.
type MonitoringRepo interface {
	// --- Service Control ---
	SetServiceStatus(ctx context.Context, tenantID, status string) error
	GetServiceStatus(ctx context.Context, tenantID string) (string, error)
	PingContext(ctx context.Context) error

	// --- Metrics ---
	CreateMetric(ctx context.Context, m *models.Metric) error
	RecordMetric(ctx context.Context, tenantID string, req models.RecordMetricRequest) error
	ListMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error)
	GetMetricSeries(ctx context.Context, tenantID, name string, since, until *time.Time, limit int) ([]models.MetricSeriesPoint, error)
	GetMetricSummary(ctx context.Context, tenantID, name string, since, until *time.Time) (*models.MetricSummary, error)

	// --- Alert Rules ---
	CreateRule(ctx context.Context, rule *models.AlertRule) error
	ListRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error)
	GetRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error)
	UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteRule(ctx context.Context, tenantID, id string) error
	ToggleRule(ctx context.Context, tenantID, id string, enabled bool) error
	SuppressRule(ctx context.Context, tenantID, id string, reason string, durationH *int) error
	UnsuppressRule(ctx context.Context, tenantID, id string) error

	// --- Alerts ---
	CreateAlert(ctx context.Context, alert *models.Alert) error
	ListAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error)
	ListActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error)
	GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error)
	AcknowledgeAlert(ctx context.Context, tenantID, id, ackBy string, comment string) error
	ResolveAlert(ctx context.Context, tenantID, id string, comment string) error
	UpdateAlertStatus(ctx context.Context, tenantID, id, severity, status string) error

	// --- Notification Channels ---
	CreateChannel(ctx context.Context, ch *models.NotificationChannel) error
	ListChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error)
	GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error)
	ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error

	// --- Escalation Policies ---
	CreateEscalationPolicy(ctx context.Context, ep *models.EscalationPolicy) error
	ListEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error)

	// --- Notification History ---
	CreateNotificationRecord(ctx context.Context, nr *models.NotificationRecord) error
	ListNotificationRecords(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error)

	// --- Dashboard Widgets ---
	CreateWidgetConfig(ctx context.Context, w *models.WidgetConfig) error
	ListWidgetConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.WidgetConfig, error)

	// --- Anomalies ---
	CreateAnomaly(ctx context.Context, a *models.Anomaly) error
	ListAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error)
	CountAnomaliesByMetric(ctx context.Context, tenantID string) ([]struct {
		Metric   string  `db:"metric"`
		Count    int     `db:"count"`
		AvgScore float64 `db:"avg_score"`
	}, error)
	CountAnomaliesBySeverity(ctx context.Context, tenantID string) ([]struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}, error)
	CountAnomaliesLast24h(ctx context.Context, tenantID string) (int, error)

	// --- Aggregation Helpers ---
	CountAlertsBySeverity(ctx context.Context, tenantID string) ([]models.Alert, error)
	RuleAlertCounts(ctx context.Context, tenantID string) ([]models.RuleAlertCounts, error)
}
