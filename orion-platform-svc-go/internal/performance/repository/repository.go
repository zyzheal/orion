package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/performance/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateBaseline(ctx context.Context, tenantID string, b *models.Baseline) (*models.Baseline, error) {
	b.ID = uuid.New().String()
	b.TenantID = tenantID
	b.Status = "active"
	b.CreatedAt = time.Now().UTC()
	if b.WindowDays <= 0 {
		b.WindowDays = 7
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO performance_baselines (id, tenant_id, service_name, metric, threshold, window_days, status, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		b.ID, b.TenantID, b.ServiceName, b.Metric, b.Threshold, b.WindowDays, b.Status, b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return r.GetBaselineByID(ctx, b.ID, tenantID)
}

func (r *Repository) ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error) {
	var baselines []models.Baseline
	err := r.db.SelectContext(ctx, &baselines,
		`SELECT id, tenant_id, service_name, metric, threshold, window_days, status, created_at
		 FROM performance_baselines WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if baselines == nil {
		baselines = []models.Baseline{}
	}
	return baselines, nil
}

func (r *Repository) GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error) {
	var b models.Baseline
	err := r.db.GetContext(ctx, &b,
		`SELECT id, tenant_id, service_name, metric, threshold, window_days, status, created_at
		 FROM performance_baselines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &b, err
}

func (r *Repository) GetEvaluationHistory(ctx context.Context, baselineID string, tenantID string) ([]models.Evaluation, error) {
	var evaluations []models.Evaluation
	err := r.db.SelectContext(ctx, &evaluations,
		`SELECT id, tenant_id, baseline_id, value, status, timestamp, created_at
		 FROM performance_evaluations WHERE baseline_id=$1 AND tenant_id=$2 ORDER BY timestamp DESC`,
		baselineID, tenantID)
	if err != nil {
		return nil, err
	}
	if evaluations == nil {
		evaluations = []models.Evaluation{}
	}
	return evaluations, nil
}

func (r *Repository) RecordEvaluation(ctx context.Context, tenantID string, baselineID string, value float64, status string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO performance_evaluations (id, tenant_id, baseline_id, value, status, timestamp, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New().String(), tenantID, baselineID, value, status, time.Now().UTC(), time.Now().UTC())
	return err
}

func (r *Repository) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	var p models.Profile
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, service_name, timestamp, created_at
		 FROM performance_profiles WHERE tenant_id=$1 AND service_name=$2 ORDER BY timestamp DESC LIMIT 1`,
		tenantID, serviceName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

func (r *Repository) GetBottlenecks(ctx context.Context, tenantID string, profileID string) ([]models.Bottleneck, error) {
	var bottlenecks []models.Bottleneck
	err := r.db.SelectContext(ctx, &bottlenecks,
		`SELECT id, profile_id, service_name, type, description, score
		 FROM performance_bottlenecks WHERE profile_id=$1 AND tenant_id=$2 ORDER BY score DESC`,
		profileID, tenantID)
	if err != nil {
		return nil, err
	}
	if bottlenecks == nil {
		bottlenecks = []models.Bottleneck{}
	}
	return bottlenecks, nil
}

func (r *Repository) GetSuggestions(ctx context.Context, tenantID string, serviceName string) ([]models.Suggestion, error) {
	var suggestions []models.Suggestion
	err := r.db.SelectContext(ctx, &suggestions,
		`SELECT id, service_name, type, description, priority
		 FROM performance_suggestions WHERE service_name=$1 AND tenant_id=$2 ORDER BY priority`,
		serviceName, tenantID)
	if err != nil {
		return nil, err
	}
	if suggestions == nil {
		suggestions = []models.Suggestion{}
	}
	return suggestions, nil
}

func (r *Repository) DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error) {
	change := req.Current - req.Previous
	pct := 0.0
	if req.Previous > 0 {
		pct = change / req.Previous * 100
	}
	result := &models.RegressionResult{
		ID:          uuid.New().String(),
		ServiceName: req.ServiceName,
		Metric:      req.Metric,
		Previous:    req.Previous,
		Current:     req.Current,
		ChangePct:   pct,
		Timestamp:   time.Now().UTC(),
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO performance_regressions (id, tenant_id, service_name, metric, previous, current, change_pct, timestamp)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		result.ID, tenantID, result.ServiceName, result.Metric, result.Previous, result.Current, result.ChangePct, result.Timestamp)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO performance_test_results (id, tenant_id, service_name, test_name, duration, status, timestamp)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New().String(), tenantID, req.ServiceName, req.TestName, req.Duration, req.Status, time.Now().UTC())
	return err
}

func (r *Repository) GetTestResults(ctx context.Context, tenantID string, serviceName string) ([]models.Baseline, error) {
	// Simplified - returns empty list for now
	return []models.Baseline{}, nil
}
