package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/visor-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL data access for all visor domain entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Dashboard ====================

// Create persists a new dashboard.
func (r *Repository) Create(ctx context.Context, d *models.Dashboard) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dashboards (id, tenant_id, name, dashboard_type, config, layout, shared)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		d.ID, d.TenantID, d.Name, d.DashboardType, d.Config, d.Layout, d.Shared)
	return err
}

// List returns paginated dashboards for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Dashboard, error) {
	var items []models.Dashboard
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at
		 FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a single dashboard by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	var d models.Dashboard
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at
		 FROM dashboards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Update modifies an existing dashboard's mutable fields.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	d, err := r.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		d.Name = *req.Name
	}
	if req.DashboardType != nil {
		d.DashboardType = *req.DashboardType
	}
	if req.Config != nil {
		d.Config = req.Config
	}
	if req.Layout != nil {
		d.Layout = req.Layout
	}
	if req.Shared != nil {
		d.Shared = *req.Shared
	}
	_, err = r.db.ExecContext(ctx,
		`UPDATE dashboards SET name=$1, dashboard_type=$2, config=$3, layout=$4, shared=$5
		 WHERE id=$6 AND tenant_id=$7`,
		d.Name, d.DashboardType, d.Config, d.Layout, d.Shared, id, tenantID)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// Delete removes a dashboard by ID and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dashboards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of dashboards for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dashboards WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Monitor Host ====================

// CreateHost persists a new monitor host.
func (r *Repository) CreateHost(ctx context.Context, h *models.MonitorHost) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO monitor_hosts (id, tenant_id, name, host, port, status, os_type, tags, agent_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		h.ID, h.TenantID, h.Name, h.Host, h.Port, h.Status, h.OSType, h.Tags, h.AgentID)
	return err
}

// ListHosts returns paginated monitor hosts for a tenant.
func (r *Repository) ListHosts(ctx context.Context, tenantID string, offset, limit int) ([]models.MonitorHost, error) {
	var items []models.MonitorHost
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, host, port, status, os_type, tags, agent_id, last_heartbeat, created_at, updated_at
		 FROM monitor_hosts WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetHostByID returns a single monitor host by ID and tenant.
func (r *Repository) GetHostByID(ctx context.Context, tenantID, id string) (*models.MonitorHost, error) {
	var h models.MonitorHost
	err := r.db.GetContext(ctx, &h,
		`SELECT id, tenant_id, name, host, port, status, os_type, tags, agent_id, last_heartbeat, created_at, updated_at
		 FROM monitor_hosts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// UpdateHost modifies an existing monitor host's mutable fields.
func (r *Repository) UpdateHost(ctx context.Context, tenantID, id string, req *models.UpdateHostRequest) (*models.MonitorHost, error) {
	h, err := r.GetHostByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		h.Name = *req.Name
	}
	if req.Host != nil {
		h.Host = *req.Host
	}
	if req.Port != nil {
		h.Port = *req.Port
	}
	if req.OSType != nil {
		h.OSType = req.OSType
	}
	if req.Tags != nil {
		h.Tags = req.Tags
	}
	if req.Status != nil {
		h.Status = *req.Status
	}
	h.UpdatedAt = time.Now()
	_, err = r.db.ExecContext(ctx,
		`UPDATE monitor_hosts SET name=$1, host=$2, port=$3, os_type=$4, tags=$5, status=$6, updated_at=$7
		 WHERE id=$8 AND tenant_id=$9`,
		h.Name, h.Host, h.Port, h.OSType, h.Tags, h.Status, h.UpdatedAt, id, tenantID)
	if err != nil {
		return nil, err
	}
	return h, nil
}

// DeleteHost removes a monitor host by ID and tenant.
func (r *Repository) DeleteHost(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM monitor_hosts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// CountHosts returns the total number of monitor hosts for a tenant.
func (r *Repository) CountHosts(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM monitor_hosts WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountHostsByStatus returns host counts grouped by status for a tenant.
func (r *Repository) CountHostsByStatus(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM monitor_hosts WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		result[status] = count
	}
	return result, rows.Err()
}

// UpdateHostHeartbeat updates the last_heartbeat timestamp for a host.
func (r *Repository) UpdateHostHeartbeat(ctx context.Context, tenantID, hostID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE monitor_hosts SET last_heartbeat=NOW(), status='online', updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`, hostID, tenantID)
	return err
}

// ==================== Alert Rule ====================

// CreateAlertRule persists a new alert rule.
func (r *Repository) CreateAlertRule(ctx context.Context, rule *models.AlertRule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_rules (id, tenant_id, name, metric, condition, threshold, severity, enabled, suppressed, cooldown_ms, tags, description)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		rule.ID, rule.TenantID, rule.Name, rule.Metric, rule.Condition, rule.Threshold,
		rule.Severity, rule.Enabled, rule.Suppressed, rule.CooldownMs, rule.Tags, rule.Description)
	return err
}

// ListAlertRules returns all alert rules for a tenant.
func (r *Repository) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	var items []models.AlertRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, metric, condition, threshold, severity, enabled, suppressed, cooldown_ms, tags, description, created_at, updated_at
		 FROM alert_rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// GetAlertRuleByID returns a single alert rule by ID and tenant.
func (r *Repository) GetAlertRuleByID(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	var rule models.AlertRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT id, tenant_id, name, metric, condition, threshold, severity, enabled, suppressed, cooldown_ms, tags, description, created_at, updated_at
		 FROM alert_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// UpdateAlertRule modifies an existing alert rule.
func (r *Repository) UpdateAlertRule(ctx context.Context, tenantID, id string, req *models.UpdateAlertRuleRequest) (*models.AlertRule, error) {
	rule, err := r.GetAlertRuleByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.Metric != nil {
		rule.Metric = *req.Metric
	}
	if req.Condition != nil {
		rule.Condition = *req.Condition
	}
	if req.Threshold != nil {
		rule.Threshold = *req.Threshold
	}
	if req.Severity != nil {
		rule.Severity = *req.Severity
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	if req.Suppressed != nil {
		rule.Suppressed = *req.Suppressed
	}
	if req.CooldownMs != nil {
		rule.CooldownMs = *req.CooldownMs
	}
	if req.Tags != nil {
		rule.Tags = req.Tags
	}
	if req.Description != nil {
		rule.Description = req.Description
	}
	rule.UpdatedAt = time.Now()
	_, err = r.db.ExecContext(ctx,
		`UPDATE alert_rules SET name=$1, metric=$2, condition=$3, threshold=$4, severity=$5, enabled=$6, suppressed=$7, cooldown_ms=$8, tags=$9, description=$10, updated_at=$11
		 WHERE id=$12 AND tenant_id=$13`,
		rule.Name, rule.Metric, rule.Condition, rule.Threshold, rule.Severity,
		rule.Enabled, rule.Suppressed, rule.CooldownMs, rule.Tags, rule.Description,
		rule.UpdatedAt, id, tenantID)
	if err != nil {
		return nil, err
	}
	return rule, nil
}

// DeleteAlertRule removes an alert rule by ID and tenant.
func (r *Repository) DeleteAlertRule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM alert_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ToggleAlertRule enables or disables an alert rule.
func (r *Repository) ToggleAlertRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_rules SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetAlertRuleByID(ctx, tenantID, id)
}

// GetEnabledAlertRules returns all enabled, non-suppressed rules for a tenant.
func (r *Repository) GetEnabledAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	var items []models.AlertRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, metric, condition, threshold, severity, enabled, suppressed, cooldown_ms, tags, description, created_at, updated_at
		 FROM alert_rules WHERE tenant_id=$1 AND enabled=true AND suppressed=false ORDER BY created_at DESC`, tenantID)
	return items, err
}

// ==================== Alert Instance ====================

// CreateAlertInstance persists a new triggered alert.
func (r *Repository) CreateAlertInstance(ctx context.Context, a *models.AlertInstance) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_instances (id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, tags)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		a.ID, a.TenantID, a.RuleID, a.RuleName, a.Metric, a.Value, a.Threshold,
		a.Severity, a.Status, a.Message, a.Tags)
	return err
}

// ListAlerts returns paginated alert instances for a tenant with optional status/severity filters.
func (r *Repository) ListAlerts(ctx context.Context, tenantID string, status, severity string, offset, limit int) ([]models.AlertInstance, int, error) {
	query := `SELECT id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, triggered_at, acknowledged_at, acknowledged_by, resolved_at, tags
		      FROM alert_instances WHERE tenant_id=$1`
	countQuery := `SELECT COUNT(*) FROM alert_instances WHERE tenant_id=$1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += ` AND status=$` + itoa(argIdx)
		countQuery += ` AND status=$` + itoa(argIdx)
		args = append(args, status)
		argIdx++
	}
	if severity != "" {
		query += ` AND severity=$` + itoa(argIdx)
		countQuery += ` AND severity=$` + itoa(argIdx)
		args = append(args, severity)
		argIdx++
	}

	// Count total
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
		return nil, 0, err
	}

	query += ` ORDER BY triggered_at DESC OFFSET $` + itoa(argIdx) + ` LIMIT $` + itoa(argIdx+1)
	args = append(args, offset, limit)

	var items []models.AlertInstance
	if err := r.db.SelectContext(ctx, &items, query, args...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetAlertByID returns a single alert instance by ID and tenant.
func (r *Repository) GetAlertByID(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	var a models.AlertInstance
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, triggered_at, acknowledged_at, acknowledged_by, resolved_at, tags
		 FROM alert_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// AcknowledgeAlert marks an alert as acknowledged.
func (r *Repository) AcknowledgeAlert(ctx context.Context, tenantID, id, userID string) (*models.AlertInstance, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_instances SET status='acknowledged', acknowledged_at=NOW(), acknowledged_by=$1
		 WHERE id=$2 AND tenant_id=$3 AND status='triggered'`, userID, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetAlertByID(ctx, tenantID, id)
}

// ResolveAlert marks an alert as resolved.
func (r *Repository) ResolveAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE alert_instances SET status='resolved', resolved_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetAlertByID(ctx, tenantID, id)
}

// GetAlertStats returns aggregated alert statistics for a tenant.
func (r *Repository) GetAlertStats(ctx context.Context, tenantID string) (*models.AlertStats, error) {
	var stats models.AlertStats
	err := r.db.GetContext(ctx, &stats,
		`SELECT
			COUNT(*) as total,
			COALESCE(SUM(CASE WHEN status = 'triggered' THEN 1 ELSE 0 END), 0) as firing,
			COALESCE(SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END), 0) as acknowledged,
			COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) as resolved,
			COALESCE(SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END), 0) as critical,
			COALESCE(SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END), 0) as warning
		 FROM alert_instances WHERE tenant_id=$1`, tenantID)
	return &stats, err
}

// ==================== Metric Data Point ====================

// InsertMetricDataPoint persists a single time-series metric data point.
func (r *Repository) InsertMetricDataPoint(ctx context.Context, dp *models.MetricDataPoint) error {
	tagsJSON, err := json.Marshal(dp.Tags)
	if err != nil {
		tagsJSON = []byte("{}")
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO metric_data_points (tenant_id, metric_name, value, tags, timestamp)
		 VALUES ($1, $2, $3, $4, $5)`,
		dp.TenantID, dp.MetricName, dp.Value, tagsJSON, dp.Timestamp)
	return err
}

// QueryMetricSeries returns data points for a metric within a time range.
func (r *Repository) QueryMetricSeries(ctx context.Context, tenantID, metricName string, start, end time.Time, maxPoints int) ([]models.MetricDataPoint, error) {
	var items []models.MetricDataPoint
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, metric_name, value, tags, timestamp
		 FROM metric_data_points
		 WHERE tenant_id=$1 AND metric_name=$2 AND timestamp BETWEEN $3 AND $4
		 ORDER BY timestamp ASC`,
		tenantID, metricName, start, end)
	if err != nil {
		return nil, err
	}
	// Downsample if too many points
	if maxPoints > 0 && len(items) > maxPoints {
		step := len(items) / maxPoints
		if step < 1 {
			step = 1
		}
		sampled := make([]models.MetricDataPoint, 0, maxPoints)
		for i := 0; i < len(items) && len(sampled) < maxPoints; i += step {
			sampled = append(sampled, items[i])
		}
		return sampled, nil
	}
	return items, nil
}

// GetLatestMetricValue returns the most recent value for a metric.
func (r *Repository) GetLatestMetricValue(ctx context.Context, tenantID, metricName string) (*float64, error) {
	var value float64
	err := r.db.GetContext(ctx, &value,
		`SELECT value FROM metric_data_points
		 WHERE tenant_id=$1 AND metric_name=$2
		 ORDER BY timestamp DESC LIMIT 1`, tenantID, metricName)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

// PruneExpiredMetrics deletes metric data points older than the retention period.
func (r *Repository) PruneExpiredMetrics(ctx context.Context, tenantID string, retentionMs int64) (int64, error) {
	cutoff := time.Now().Add(-time.Duration(retentionMs) * time.Millisecond)
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM metric_data_points WHERE tenant_id=$1 AND timestamp < $2`, tenantID, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// ==================== Notification Channel ====================

// CreateChannel persists a new notification channel.
func (r *Repository) CreateChannel(ctx context.Context, ch *models.NotificationChannel) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_channels (id, tenant_id, name, type, config, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		ch.ID, ch.TenantID, ch.Name, ch.Type, ch.Config, ch.Enabled)
	return err
}

// ListChannels returns all notification channels for a tenant.
func (r *Repository) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	var items []models.NotificationChannel
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, type, config, enabled, created_at, updated_at
		 FROM notification_channels WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// ToggleChannel enables or disables a notification channel.
func (r *Repository) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notification_channels SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}

// DeleteChannel removes a notification channel.
func (r *Repository) DeleteChannel(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Notification History ====================

// CreateNotificationHistory persists a notification delivery record.
func (r *Repository) CreateNotificationHistory(ctx context.Context, h *models.NotificationHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_history (id, tenant_id, alert_id, channel_id, channel_type, status, error_message)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		h.ID, h.TenantID, h.AlertID, h.ChannelID, h.ChannelType, h.Status, h.ErrorMessage)
	return err
}

// ListNotificationHistory returns notification records for a tenant with optional alert filter.
func (r *Repository) ListNotificationHistory(ctx context.Context, tenantID, alertID string, limit int) ([]models.NotificationHistory, error) {
	if alertID != "" {
		var items []models.NotificationHistory
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at
			 FROM notification_history WHERE tenant_id=$1 AND alert_id=$2
			 ORDER BY sent_at DESC LIMIT $3`, tenantID, alertID, limit)
		return items, err
	}
	var items []models.NotificationHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at
		 FROM notification_history WHERE tenant_id=$1
		 ORDER BY sent_at DESC LIMIT $2`, tenantID, limit)
	return items, err
}

// ==================== Helpers ====================

// itoa converts an int to its string representation for building parameterized queries.
func itoa(i int) string {
	return fmt.Sprintf("%d", i)
}
