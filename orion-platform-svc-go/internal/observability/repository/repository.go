package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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
	if err != nil {
		return nil, err
	}
	hydrateTags(&m)
	return &m, err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, q models.MetricQuery) ([]models.Metric, error) {
	query := "SELECT * FROM observability_metrics WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2
	// The index is a number, not a rune, and it carries no trailing "s". The
	// old " AND name = $" + string(rune(idx)) + "s" emitted U+0002 (STX) rather
	// than the digit "2" and then the stray "s", so the query read
	// " AND name = $\x02s": GET /observability/metrics?name=... answered 500
	// for every filtered request. Past idx 9 string(rune(idx)) is a visible
	// character or a newline, never the digits.
	if q.Name != "" {
		query += fmt.Sprintf(" AND name = $%d", idx)
		args = append(args, q.Name)
		idx++
	}
	if q.From != "" {
		query += fmt.Sprintf(" AND timestamp >= $%d", idx)
		args = append(args, q.From)
		idx++
	}
	if q.To != "" {
		query += fmt.Sprintf(" AND timestamp <= $%d", idx)
		args = append(args, q.To)
	}
	query += " ORDER BY timestamp DESC"
	var metrics []models.Metric
	err := r.db.SelectContext(ctx, &metrics, query, args...)
	if err != nil {
		return nil, err
	}
	for i := range metrics {
		hydrateTags(&metrics[i])
	}
	return metrics, err
}

func (r *Repository) CreateAlertRule(ctx context.Context, tenantID string, rule *models.AlertRule) (*models.AlertRule, error) {
	rule.ID = uuid.New().String()
	// The placeholder names the db tag, not the json tag, and the tenant comes
	// from the request context rather than the request body. Before this the
	// statement bound :tenantId (the json tag) to nothing, so POST
	// /observability/alerts failed every request with "could not find name
	// tenantId", and the tenantID parameter was never used at all.
	rule.TenantID = tenantID
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO observability_alert_rules (id, tenant_id, metric, operator, threshold, severity, enabled) VALUES (:id, :tenant_id, :metric, :operator, :threshold, :severity, :enabled)",
		rule)
	return rule, err
}

// hydrateTags unmarshals the JSONB column into Tags. A corrupt value must not
// fail the whole list, so the error is ignored and Tags stays empty for that row.
func hydrateTags(m *models.Metric) {
	if len(m.TagsJSON) == 0 {
		return
	}
	_ = json.Unmarshal(m.TagsJSON, &m.Tags)
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
