package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/statistics"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists aggregated statistics to PostgreSQL.
type Repository struct {
	db       *sqlx.DB
	retained int
}

func NewRepository(db *sqlx.DB, retained int) *Repository {
	if retained <= 0 {
		retained = 1000
	}
	return &Repository{db: db, retained: retained}
}

func (r *Repository) Store(ctx context.Context, tenantID string, m statistics.StatMetric) error {
	id := uuid.New().String()
	now := time.Now().UTC()
	if m.Timestamp.IsZero() {
		m.Timestamp = now
	}
	tagsJSON, _ := json.Marshal(m.Tags)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO statistics (id, tenant_id, name, value, unit, window, tags, recorded_at)
		VALUES (:id, :tenant_id, :name, :value, :unit, :window, :tags, :recorded_at)`,
		map[string]interface{}{
			"id":          id,
			"tenant_id":   tenantID,
			"name":        m.Name,
			"value":       m.Value,
			"unit":        m.Unit,
			"window":      "",
			"tags":        string(tagsJSON),
			"recorded_at": m.Timestamp,
		})
	if err != nil {
		return err
	}
	return r.pruneSeries(ctx, tenantID, m.Name)
}

func (r *Repository) StoreBatch(ctx context.Context, tenantID string, metrics []statistics.StatMetric) error {
	for _, m := range metrics {
		if err := r.Store(ctx, tenantID, m); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetByWindow(ctx context.Context, tenantID, name string, tags map[string]string, window statistics.AggregationWindow, now time.Time) ([]statistics.StatMetric, error) {
	cutoff := now.Add(-window.Duration())

	type statRow struct {
		Name      string    `db:"name"`
		Value     float64   `db:"value"`
		Unit      string    `db:"unit"`
		Tags      string    `db:"tags"`
		Timestamp time.Time `db:"recorded_at"`
	}

	var rows []statRow
	err := r.db.SelectContext(ctx, &rows,
		`SELECT name, value, unit, tags, recorded_at FROM statistics
		 WHERE tenant_id=$1 AND name=$2 AND recorded_at > $3 ORDER BY recorded_at DESC`,
		tenantID, name, cutoff)
	if err != nil {
		return nil, err
	}

	result := make([]statistics.StatMetric, len(rows))
	for i, row := range rows {
		tagsMap := make(map[string]string)
		_ = json.Unmarshal([]byte(row.Tags), &tagsMap)
		result[i] = statistics.StatMetric{
			Name:      row.Name,
			Value:     row.Value,
			Unit:      row.Unit,
			Timestamp: row.Timestamp,
			Tags:      tagsMap,
		}
	}
	return result, nil
}

func (r *Repository) Prune(ctx context.Context, tenantID string, retention time.Duration) int {
	cutoff := time.Now().Add(-retention)
	res, err := r.db.ExecContext(ctx, `DELETE FROM statistics WHERE tenant_id=$1 AND recorded_at < $2`, tenantID, cutoff)
	if err != nil {
		return 0
	}
	n, _ := res.RowsAffected()
	return int(n)
}

func (r *Repository) Count(ctx context.Context, tenantID string) int {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM statistics WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0
	}
	return count
}

// pruneSeries keeps only the most recent `retained` rows per (tenantID, name).
func (r *Repository) pruneSeries(ctx context.Context, tenantID, name string) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM statistics WHERE id NOT IN (
			SELECT id FROM statistics WHERE tenant_id=$1 AND name=$2 ORDER BY recorded_at DESC LIMIT $3
		)`, tenantID, name, r.retained)
	return err
}

// Ensure sentinel import is used
var _ = sentinel.NotFound

// Ensure errors import is used
var _ = errors.Is