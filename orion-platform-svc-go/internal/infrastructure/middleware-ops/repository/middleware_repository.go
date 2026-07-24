package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/infrastructure/middleware-ops/models"

	"github.com/jmoiron/sqlx"
)

// ---- InstanceRepository ----

type InstanceRepository struct {
	db *sqlx.DB
}

func NewInstanceRepository(db *sqlx.DB) *InstanceRepository {
	return &InstanceRepository{db: db}
}

func (r *InstanceRepository) Create(ctx context.Context, d *models.MiddlewareInstance) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO middleware_instances (id, tenant_id, name, type, version, host, port, status, config, labels)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.Name, d.Type, d.Version, d.Host, d.Port, d.Status, d.Config, d.Labels)
	return err
}

func (r *InstanceRepository) List(ctx context.Context, tenantID string, offset, limit int, typeFilter, statusFilter string) ([]models.MiddlewareInstance, error) {
	query := `SELECT * FROM middleware_instances WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if typeFilter != "" {
		query += fmt.Sprintf(` AND type=$%d`, idx)
		args = append(args, typeFilter)
		idx++
	}
	if statusFilter != "" {
		query += fmt.Sprintf(` AND status=$%d`, idx)
		args = append(args, statusFilter)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY created_at DESC OFFSET $%d LIMIT $%d`, idx, idx+1)
	args = append(args, offset, limit)

	var items []models.MiddlewareInstance
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *InstanceRepository) GetByID(ctx context.Context, tenantID, id string) (*models.MiddlewareInstance, error) {
	var d models.MiddlewareInstance
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM middleware_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *InstanceRepository) Update(ctx context.Context, d *models.MiddlewareInstance) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE middleware_instances
		 SET name=$1, type=$2, version=$3, host=$4, port=$5, status=$6, config=$7, labels=$8, updated_at=NOW()
		 WHERE id=$9 AND tenant_id=$10`,
		d.Name, d.Type, d.Version, d.Host, d.Port, d.Status, d.Config, d.Labels, d.ID, d.TenantID)
	return err
}

func (r *InstanceRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM middleware_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *InstanceRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM middleware_instances WHERE tenant_id=$1`, tenantID)
	return count, err
}

// HealthCounts returns aggregate counts by instance status.
func (r *InstanceRepository) HealthCounts(ctx context.Context, tenantID string) (*models.HealthCounts, error) {
	var h models.HealthCounts
	err := r.db.GetContext(ctx, &h,
		`SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'healthy') AS healthy,
			COUNT(*) FILTER (WHERE status = 'degraded') AS degraded,
			COUNT(*) FILTER (WHERE status = 'unhealthy') AS unhealthy
		 FROM middleware_instances WHERE tenant_id=$1`, tenantID)
	return &h, err
}

// ---- BackupRepository ----

type BackupRepository struct {
	db *sqlx.DB
}

func NewBackupRepository(db *sqlx.DB) *BackupRepository {
	return &BackupRepository{db: db}
}

func (r *BackupRepository) Create(ctx context.Context, d *models.BackupRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO backup_records (id, tenant_id, instance_id, status, size_bytes, location, started_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		d.ID, d.TenantID, d.InstanceID, d.Status, d.SizeBytes, d.Location, d.StartedAt)
	return err
}

func (r *BackupRepository) ListByInstance(ctx context.Context, tenantID, instanceID string) ([]models.BackupRecord, error) {
	var items []models.BackupRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM backup_records WHERE tenant_id=$1 AND instance_id=$2 ORDER BY started_at DESC`,
		tenantID, instanceID)
	return items, err
}

// ---- MetricRepository ----

type MetricRepository struct {
	db *sqlx.DB
}

func NewMetricRepository(db *sqlx.DB) *MetricRepository {
	return &MetricRepository{db: db}
}

func (r *MetricRepository) Create(ctx context.Context, d *models.MiddlewareMetric) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO middleware_metrics (id, tenant_id, middleware_id, metric_name, value, unit)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		d.ID, d.TenantID, d.MiddlewareID, d.MetricName, d.Value, d.Unit)
	return err
}

func (r *MetricRepository) List(ctx context.Context, tenantID string, offset, limit int, middlewareID, metricName string) ([]models.MiddlewareMetric, error) {
	query := `SELECT * FROM middleware_metrics WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if middlewareID != "" {
		query += fmt.Sprintf(` AND middleware_id=$%d`, idx)
		args = append(args, middlewareID)
		idx++
	}
	if metricName != "" {
		query += fmt.Sprintf(` AND metric_name=$%d`, idx)
		args = append(args, metricName)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY timestamp DESC OFFSET $%d LIMIT $%d`, idx, idx+1)
	args = append(args, offset, limit)

	var items []models.MiddlewareMetric
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ---- ConnectionPoolRepository ----

type ConnectionPoolRepository struct {
	db *sqlx.DB
}

func NewConnectionPoolRepository(db *sqlx.DB) *ConnectionPoolRepository {
	return &ConnectionPoolRepository{db: db}
}

func (r *ConnectionPoolRepository) Create(ctx context.Context, d *models.ConnectionPool) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO connection_pools (id, tenant_id, middleware_id, pool_name, active, idle, max_conn, waiting, total_created, total_closed)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.MiddlewareID, d.PoolName, d.Active, d.Idle, d.Max, d.Waiting, d.TotalCreated, d.TotalClosed)
	return err
}

func (r *ConnectionPoolRepository) List(ctx context.Context, tenantID string, offset, limit int, middlewareID string) ([]models.ConnectionPool, error) {
	query := `SELECT * FROM connection_pools WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if middlewareID != "" {
		query += fmt.Sprintf(` AND middleware_id=$%d`, idx)
		args = append(args, middlewareID)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY timestamp DESC OFFSET $%d LIMIT $%d`, idx, idx+1)
	args = append(args, offset, limit)

	var items []models.ConnectionPool
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ---- MqStatsRepository ----

type MqStatsRepository struct {
	db *sqlx.DB
}

func NewMqStatsRepository(db *sqlx.DB) *MqStatsRepository {
	return &MqStatsRepository{db: db}
}

func (r *MqStatsRepository) Create(ctx context.Context, d *models.MessageQueueStats) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO message_queue_stats (id, tenant_id, middleware_id, queue_name, message_count, consumer_count, messages_per_second, avg_latency_ms, dead_letter_count)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.MiddlewareID, d.QueueName, d.MessageCount, d.ConsumerCount, d.MessagesPerSecond, d.AvgLatencyMs, d.DeadLetterCount)
	return err
}

func (r *MqStatsRepository) List(ctx context.Context, tenantID string, offset, limit int, middlewareID string) ([]models.MessageQueueStats, error) {
	query := `SELECT * FROM message_queue_stats WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if middlewareID != "" {
		query += fmt.Sprintf(` AND middleware_id=$%d`, idx)
		args = append(args, middlewareID)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY timestamp DESC OFFSET $%d LIMIT $%d`, idx, idx+1)
	args = append(args, offset, limit)

	var items []models.MessageQueueStats
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ---- AlertRepository ----

type AlertRepository struct {
	db *sqlx.DB
}

func NewAlertRepository(db *sqlx.DB) *AlertRepository {
	return &AlertRepository{db: db}
}

func (r *AlertRepository) Create(ctx context.Context, d *models.MiddlewareAlert) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO middleware_alerts (id, tenant_id, middleware_id, middleware_name, alert_type, severity, message, value, threshold)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.MiddlewareID, d.MiddlewareName, d.AlertType, d.Severity, d.Message, d.Value, d.Threshold)
	return err
}

func (r *AlertRepository) List(ctx context.Context, tenantID string, offset, limit int, severity, alertType string) ([]models.MiddlewareAlert, error) {
	query := `SELECT * FROM middleware_alerts WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if severity != "" {
		query += fmt.Sprintf(` AND severity=$%d`, idx)
		args = append(args, severity)
		idx++
	}
	if alertType != "" {
		query += fmt.Sprintf(` AND alert_type=$%d`, idx)
		args = append(args, alertType)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY created_at DESC OFFSET $%d LIMIT $%d`, idx, idx+1)
	args = append(args, offset, limit)

	var items []models.MiddlewareAlert
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *AlertRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM middleware_alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// AlertCounts returns aggregate counts for alerts.
func (r *AlertRepository) AlertCounts(ctx context.Context, tenantID string) (*models.AlertCounts, error) {
	var a models.AlertCounts
	err := r.db.GetContext(ctx, &a,
		`SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical
		 FROM middleware_alerts WHERE tenant_id=$1`, tenantID)
	return &a, err
}
