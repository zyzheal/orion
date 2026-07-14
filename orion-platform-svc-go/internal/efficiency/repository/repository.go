package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Metrics ---

func (r *Repository) CreateMetric(ctx context.Context, metric *models.Metric) error {
	metric.ID = uuid.New().String()
	metric.CreatedAt = time.Now().UTC()
	metric.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_metrics (id, tenant_id, name, description, metric_type, scope, scope_id, baseline_value, current_value, target_value, unit, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :metricType, :scope, :scopeId, :baselineValue, :currentValue, :targetValue, :unit, :status, :createdAt, :updatedAt)`,
		metric)
	return err
}

func (r *Repository) GetMetricByID(ctx context.Context, tenantID, id string) (*models.Metric, error) {
	var metric models.Metric
	err := r.db.GetContext(ctx, &metric, `SELECT * FROM efficiency_metrics WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &metric, err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, filter *models.MetricFilter) ([]models.Metric, int, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.MetricType != nil && *filter.MetricType != "" {
			where += fmt.Sprintf(" AND metric_type=$%d", argIdx); args = append(args, *filter.MetricType); argIdx++
		}
		if filter.Scope != nil && *filter.Scope != "" {
			where += fmt.Sprintf(" AND scope=$%d", argIdx); args = append(args, *filter.Scope); argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx); args = append(args, *filter.Status); argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var metrics []models.Metric
	err := r.db.SelectContext(ctx, &metrics, fmt.Sprintf(`SELECT * FROM efficiency_metrics %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM efficiency_metrics WHERE tenant_id=$1`, tenantID)
	return metrics, total, err
}

func (r *Repository) UpdateMetric(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Metric, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses, args := buildSetClause(updates)
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE efficiency_metrics SET %s WHERE id=$%d AND tenant_id=$%d`, setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return r.GetMetricByID(ctx, tenantID, id)
}

func (r *Repository) DeleteMetric(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM efficiency_metrics WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Scores ---

func (r *Repository) CreateScore(ctx context.Context, score *models.Score) error {
	score.ID = uuid.New().String()
	score.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_scores (id, tenant_id, metric_id, score, score_date, notes, created_at)
		 VALUES (:id, :tenantId, :metricId, :score, :scoreDate, :notes, :createdAt)`,
		score)
	return err
}

func (r *Repository) ListScoresByMetric(ctx context.Context, tenantID, metricID string) ([]models.Score, error) {
	var scores []models.Score
	err := r.db.SelectContext(ctx, &scores,
		`SELECT * FROM efficiency_scores WHERE tenant_id=$1 AND metric_id=$2 ORDER BY score_date DESC`, tenantID, metricID)
	return scores, err
}

// --- Recommendations ---

func (r *Repository) CreateRecommendation(ctx context.Context, rec *models.Recommendation) error {
	rec.ID = uuid.New().String()
	rec.CreatedAt = time.Now().UTC()
	rec.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO efficiency_recommendations (id, tenant_id, metric_id, title, description, impact_level, estimated_savings, implementation_effort, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :metricId, :title, :description, :impactLevel, :estimatedSavings, :implementationEffort, :status, :createdAt, :updatedAt)`,
		rec)
	return err
}

func (r *Repository) GetRecommendationByID(ctx context.Context, tenantID, id string) (*models.Recommendation, error) {
	var rec models.Recommendation
	err := r.db.GetContext(ctx, &rec, `SELECT * FROM efficiency_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &rec, err
}

func (r *Repository) ListRecommendations(ctx context.Context, tenantID string, status *string) ([]models.Recommendation, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if status != nil && *status != "" {
		where += " AND status=$2"
		args = append(args, *status)
	}
	var recs []models.Recommendation
	err := r.db.SelectContext(ctx, &recs, fmt.Sprintf(`SELECT * FROM efficiency_recommendations %s ORDER BY created_at DESC`, where), args...)
	return recs, err
}

func (r *Repository) UpdateRecommendation(ctx context.Context, tenantID, id string, status string) (*models.Recommendation, error) {
	var result sql.Result
	var err error
	switch status {
	case "accepted":
		result, err = r.db.ExecContext(ctx, `UPDATE efficiency_recommendations SET status=$1, accepted_at=$2 WHERE id=$3 AND tenant_id=$4 AND status=$5`,
			"accepted", time.Now().UTC(), id, tenantID, "suggested")
	case "implemented":
		result, err = r.db.ExecContext(ctx, `UPDATE efficiency_recommendations SET status=$1, implemented_at=$2 WHERE id=$3 AND tenant_id=$4 AND status=$5`,
			"implemented", time.Now().UTC(), id, tenantID, "accepted")
	case "rejected":
		result, err = r.db.ExecContext(ctx, `UPDATE efficiency_recommendations SET status=$1 WHERE id=$2 AND tenant_id=$3`,
			"rejected", id, tenantID)
	default:
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return nil, ErrNotFound
	}
	return r.GetRecommendationByID(ctx, tenantID, id)
}

func (r *Repository) DeleteRecommendation(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM efficiency_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.EfficiencyStats, error) {
	stats := &models.EfficiencyStats{}

	err := r.db.GetContext(ctx, &stats.TotalMetrics, `SELECT COUNT(*) FROM efficiency_metrics WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.AvgScore,
		`SELECT COALESCE(AVG(score), 0) FROM efficiency_scores WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalRecommendations,
		`SELECT COUNT(*) FROM efficiency_recommendations WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.AcceptedCount,
		`SELECT COUNT(*) FROM efficiency_recommendations WHERE tenant_id=$1 AND status='accepted'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.ImplementedCount,
		`SELECT COUNT(*) FROM efficiency_recommendations WHERE tenant_id=$1 AND status='implemented'`, tenantID)

	return stats, err
}

func buildSetClause(updates map[string]interface{}) (string, []interface{}) {
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	return strings.Join(clauses, ", "), args
}