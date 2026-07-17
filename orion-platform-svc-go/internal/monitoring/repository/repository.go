package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// PingContext verifies that the database connection is alive.
// Useful for health checks before performing queries.
func (r *Repository) PingContext(ctx context.Context) error {
	return r.db.PingContext(ctx)
}

// --- Service Control ---

func (r *Repository) SetServiceStatus(ctx context.Context, tenantID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO monitoring_status (tenant_id, status, updated_at) VALUES ($1, $2, NOW())
			ON CONFLICT (tenant_id) DO UPDATE SET status=$2, updated_at=NOW()`,
		tenantID, status)
	return err
}

func (r *Repository) GetServiceStatus(ctx context.Context, tenantID string) (string, error) {
	var status string
	err := r.db.GetContext(ctx, &status,
		`SELECT status FROM monitoring_status WHERE tenant_id=$1`, tenantID)
	return status, err
}

// --- Metrics ---

func (r *Repository) CreateMetric(ctx context.Context, m *models.Metric) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO monitoring_metrics (id, tenant_id, name, type, unit, labels, help, enabled, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :type, :unit, :labels, :help, :enabled, :created_at, :updated_at)
			ON CONFLICT (tenant_id, name) DO NOTHING`,
		m)
	return err
}

func (r *Repository) RecordMetric(ctx context.Context, tenantID string, req models.RecordMetricRequest) error {
	labels, _ := json.Marshal(req.Labels)
	ts := time.Now().UTC()
	if req.Timestamp != nil {
		ts = *req.Timestamp
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO monitoring_metric_points (id, tenant_id, metric_name, value, labels, timestamp)
			VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), tenantID, req.Name, req.Value, string(labels), ts)
	return err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Metric
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM monitoring_metrics WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetMetricSeries(ctx context.Context, tenantID, name string, since, until *time.Time, limit int) ([]models.MetricSeriesPoint, error) {
	if limit <= 0 {
		limit = 100
	}
	var sql string
	var args []interface{}
	if since != nil && until != nil {
		sql = `SELECT * FROM monitoring_metric_points WHERE tenant_id=$1 AND metric_name=$2 AND timestamp BETWEEN $3 AND $4 ORDER BY timestamp DESC LIMIT $5`
		args = []interface{}{tenantID, name, *since, *until, limit}
	} else if since != nil {
		sql = `SELECT * FROM monitoring_metric_points WHERE tenant_id=$1 AND metric_name=$2 AND timestamp >= $3 ORDER BY timestamp DESC LIMIT $4`
		args = []interface{}{tenantID, name, *since, limit}
	} else {
		sql = `SELECT * FROM monitoring_metric_points WHERE tenant_id=$1 AND metric_name=$2 ORDER BY timestamp DESC LIMIT $3`
		args = []interface{}{tenantID, name, limit}
	}
	var points []models.MetricSeriesPoint
	err := r.db.SelectContext(ctx, &points, sql, args...)
	return points, err
}

func (r *Repository) GetMetricSummary(ctx context.Context, tenantID, name string, since, until *time.Time) (*models.MetricSummary, error) {
	var sql string
	var args []interface{}
	if since != nil && until != nil {
		sql = `SELECT MIN(value), MAX(value), AVG(value), COUNT(*) FROM monitoring_metric_points WHERE tenant_id=$1 AND metric_name=$2 AND timestamp BETWEEN $3 AND $4`
		args = []interface{}{tenantID, name, *since, *until}
	} else {
		sql = `SELECT MIN(value), MAX(value), AVG(value), COUNT(*) FROM monitoring_metric_points WHERE tenant_id=$1 AND metric_name=$2`
		args = []interface{}{tenantID, name}
	}
	var summary models.MetricSummary
	var count int
	err := r.db.QueryRowContext(ctx, sql, args...).Scan(&summary.Min, &summary.Max, &summary.Avg, &count)
	if err != nil {
		return nil, err
	}
	summary.Name = name
	summary.SampleCount = count
	return &summary, nil
}

// --- Alert Rules ---

func (r *Repository) CreateRule(ctx context.Context, rule *models.AlertRule) error {
	rule.ID = uuid.New().String()
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alert_rules (id, tenant_id, name, metric, operator, threshold, evaluation_period, severity, channels, enabled, active, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :metric, :operator, :threshold, :evaluation_period, :severity, :channels, :enabled, :active, :created_at, :updated_at)`,
		rule)
	return err
}

func (r *Repository) ListRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.AlertRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM alert_rules WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	var rule models.AlertRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM alert_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	// Build SET clause dynamically
	if len(updates) == 0 {
		return nil
	}
	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE alert_rules SET %s WHERE id=$%d AND tenant_id=$%d`,
		joinSet(setParts), idx-1, idx)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM alert_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) ToggleRule(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_rules SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}

func (r *Repository) SuppressRule(ctx context.Context, tenantID, id string, reason string, durationH *int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_rules SET active=false, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

func (r *Repository) UnsuppressRule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_rules SET active=true, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

// --- Alerts ---

func (r *Repository) CreateAlert(ctx context.Context, alert *models.Alert) error {
	alert.ID = uuid.New().String()
	alert.CreatedAt = time.Now().UTC()
	alert.UpdatedAt = time.Now().UTC()
	if alert.Status == "" {
		alert.Status = "firing"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alerts (id, tenant_id, rule_id, status, message, value, severity, created_at, updated_at)
			VALUES (:id, :tenant_id, :rule_id, :status, :message, :value, :severity, :created_at, :updated_at)`,
		alert)
	return err
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Alert
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM alerts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) ListActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Alert
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM alerts WHERE tenant_id=$1 AND status IN ('firing', 'acknowledged') ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	var alert models.Alert
	err := r.db.GetContext(ctx, &alert,
		`SELECT * FROM alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

func (r *Repository) AcknowledgeAlert(ctx context.Context, tenantID, id, ackBy string, comment string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alerts SET status='acknowledged', ack_by=$1, ack_at=NOW(), updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		ackBy, id, tenantID)
	return err
}

func (r *Repository) ResolveAlert(ctx context.Context, tenantID, id string, comment string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alerts SET status='resolved', resolved_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

// --- Notification Channels ---

func (r *Repository) CreateChannel(ctx context.Context, ch *models.NotificationChannel) error {
	ch.ID = uuid.New().String()
	ch.CreatedAt = time.Now().UTC()
	ch.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notification_channels (id, tenant_id, name, type, config, enabled, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :type, :config, :enabled, :created_at, :updated_at)`,
		ch)
	return err
}

func (r *Repository) ListChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.NotificationChannel
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_channels WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	var ch models.NotificationChannel
	err := r.db.GetContext(ctx, &ch,
		`SELECT * FROM notification_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *Repository) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notification_channels SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}

// --- Escalation Policies ---

func (r *Repository) CreateEscalationPolicy(ctx context.Context, ep *models.EscalationPolicy) error {
	ep.ID = uuid.New().String()
	ep.CreatedAt = time.Now().UTC()
	ep.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO escalation_policies (id, tenant_id, name, levels, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :levels, :created_at, :updated_at)`,
		ep)
	return err
}

func (r *Repository) ListEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.EscalationPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM escalation_policies WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

// --- Notification History ---

func (r *Repository) CreateNotificationRecord(ctx context.Context, nr *models.NotificationRecord) error {
	nr.ID = uuid.New().String()
	nr.SentAt = time.Now().UTC()
	nr.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notification_records (id, tenant_id, alert_id, channel_id, status, message, sent_at, created_at)
			VALUES (:id, :tenant_id, :alert_id, :channel_id, :status, :message, :sent_at, :created_at)`,
		nr)
	return err
}

func (r *Repository) ListNotificationRecords(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.NotificationRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_records WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

// --- Dashboard Widgets ---

func (r *Repository) CreateWidgetConfig(ctx context.Context, w *models.WidgetConfig) error {
	w.ID = uuid.New().String()
	w.CreatedAt = time.Now().UTC()
	w.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dashboard_widgets (id, tenant_id, name, type, metric, config, position, enabled, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :type, :metric, :config, :position, :enabled, :created_at, :updated_at)`,
		w)
	return err
}

func (r *Repository) ListWidgetConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.WidgetConfig, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.WidgetConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dashboard_widgets WHERE tenant_id=$1 ORDER BY position LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

// --- Anomalies ---

func (r *Repository) CreateAnomaly(ctx context.Context, a *models.Anomaly) error {
	a.ID = uuid.New().String()
	a.DetectedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO anomalies (id, tenant_id, metric, score, baseline, actual, severity, description, detected_at)
			VALUES (:id, :tenant_id, :metric, :score, :baseline, :actual, :severity, :description, :detected_at)`,
		a)
	return err
}

func (r *Repository) ListAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Anomaly
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM anomalies WHERE tenant_id=$1 ORDER BY detected_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

// CountAnomaliesByMetric returns the count and average score grouped by metric.
func (r *Repository) CountAnomaliesByMetric(ctx context.Context, tenantID string) ([]struct {
	Metric   string  `db:"metric"`
	Count    int     `db:"count"`
	AvgScore float64 `db:"avg_score"`
}, error) {
	var rows []struct {
		Metric   string  `db:"metric"`
		Count    int     `db:"count"`
		AvgScore float64 `db:"avg_score"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT metric, COUNT(*) AS count, AVG(score) AS avg_score
		 FROM anomalies WHERE tenant_id=$1 GROUP BY metric ORDER BY count DESC`,
		tenantID)
	return rows, err
}

// CountAnomaliesBySeverity returns anomaly counts grouped by severity.
func (r *Repository) CountAnomaliesBySeverity(ctx context.Context, tenantID string) ([]struct {
	Severity string `db:"severity"`
	Count    int    `db:"count"`
}, error) {
	var rows []struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT severity, COUNT(*) AS count FROM anomalies WHERE tenant_id=$1 GROUP BY severity`,
		tenantID)
	return rows, err
}

// CountAnomaliesLast24h returns the number of anomalies detected in the last 24 hours.
func (r *Repository) CountAnomaliesLast24h(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM anomalies WHERE tenant_id=$1 AND detected_at >= NOW() - INTERVAL '24 hours'`,
		tenantID)
	return count, err
}

// UpdateAlertStatus updates an alert's status and/or severity atomically.
func (r *Repository) UpdateAlertStatus(ctx context.Context, tenantID, id, severity, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alerts SET severity=$1, status=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
		severity, status, id, tenantID)
	return err
}

// CountAlertsBySeverity returns alert counts grouped by severity and status.
func (r *Repository) CountAlertsBySeverity(ctx context.Context, tenantID string) ([]models.Alert, error) {
	var items []models.Alert
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM alerts WHERE tenant_id=$1`, tenantID)
	return items, err
}

// RuleAlertCounts returns (rule_name, active_alert_count) for every rule that has active alerts.
func (r *Repository) RuleAlertCounts(ctx context.Context, tenantID string) ([]models.RuleAlertCounts, error) {
	var rows []models.RuleAlertCounts
	err := r.db.SelectContext(ctx, &rows,
		`SELECT r.name AS rule_name, COUNT(*) AS active
		 FROM alerts a
		 JOIN alert_rules r ON r.id = a.rule_id
		 WHERE a.tenant_id=$1 AND a.status IN ('firing', 'acknowledged')
		 GROUP BY r.name
		 HAVING COUNT(*) > 0
		 ORDER BY active DESC`,
		tenantID)
	return rows, err
}

// --- Helpers ---

func joinSet(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}
