package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/observability/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateMetric(ctx context.Context, tenantID string, m *models.Metric) (*models.Metric, error) {
	m.Timestamp = time.Now().UTC()
	tagsJSON := "{}"
	if m.Tags != nil {
		b, err := json.Marshal(m.Tags)
		if err == nil {
			tagsJSON = string(b)
		}
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO observability_metrics (tenant_id, name, value, tags, timestamp) VALUES (:tenantId, :name, :value, :tags, :timestamp)",
		map[string]interface{}{"tenantId": tenantID, "name": m.Name, "value": m.Value, "tags": tagsJSON, "timestamp": m.Timestamp})
	return m, err
}

func (r *Repository) GetMetric(ctx context.Context, tenantID, name string) (*models.Metric, error) {
	var m models.Metric
	err := r.db.GetContext(ctx, &m,
		"SELECT * FROM observability_metrics WHERE tenant_id=$1 AND name=$2 ORDER BY timestamp DESC LIMIT 1", tenantID, name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &m, err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, q models.MetricQuery) ([]models.Metric, error) {
	query := "SELECT * FROM observability_metrics WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2
	if q.Name != "" {
		query += " AND name = $" + string(rune(idx)) + "s"
		args = append(args, q.Name)
		idx++
	}
	if q.From != "" {
		query += " AND timestamp >= $" + string(rune(idx)) + "s"
		args = append(args, q.From)
		idx++
	}
	if q.To != "" {
		query += " AND timestamp <= $" + string(rune(idx)) + "s"
		args = append(args, q.To)
	}
	query += " ORDER BY timestamp DESC"
	var metrics []models.Metric
	err := r.db.SelectContext(ctx, &metrics, query, args...)
	return metrics, err
}

func (r *Repository) CreateAlertRule(ctx context.Context, tenantID string, rule *models.AlertRule) (*models.AlertRule, error) {
	rule.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO observability_alert_rules (id, tenant_id, metric, operator, threshold, severity, enabled) VALUES (:id, :tenantId, :metric, :operator, :threshold, :severity, :enabled)",
		rule)
	return rule, err
}

func (r *Repository) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	var rules []models.AlertRule
	err := r.db.SelectContext(ctx, &rules, "SELECT * FROM observability_alert_rules WHERE tenant_id=$1 ORDER BY id", tenantID)
	return rules, err
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS observability_metrics (
			tenant_id VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			value DECIMAL(16,6) NOT NULL,
			tags JSONB DEFAULT '{}',
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL
		)
	`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS observability_alert_rules (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			metric VARCHAR(255) NOT NULL,
			operator VARCHAR(10) NOT NULL,
			threshold DECIMAL(16,6) NOT NULL,
			severity VARCHAR(50) NOT NULL,
			enabled BOOLEAN NOT NULL DEFAULT TRUE
		)
	`)
	return err
}
