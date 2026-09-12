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

// Table names are deliberately mixed, and not by accident:
//
//	baselines / evaluations / profiles
//	    Migration 152 created these under bare names and that migration has
//	    already run in every deployed database, so the repository must use the
//	    names that actually exist. Referencing performance_baselines and the
//	    like is what made every call in this file fail with
//	    `relation does not exist`.
//	performance_bottlenecks / performance_suggestions /
//	    performance_regressions / performance_test_results
//	    Migration 575 creates these tables under the module-prefixed
//	    convention used by 100/106/145 (branch_policy_records,
//	    capacity_records, middleware_ops_records).
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateBaseline(ctx context.Context, tenantID string, b *models.Baseline) (*models.Baseline, error) {
	b.ID = uuid.New().String()
	b.TenantID = tenantID
	b.Status = models.StatusActive
	b.CreatedAt = time.Now().UTC()
	if b.WindowDays <= 0 {
		b.WindowDays = 7
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO baselines (id, tenant_id, service_name, metric, threshold, window_days, status, created_at)
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
		 FROM baselines WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
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
		 FROM baselines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &b, err
}

func (r *Repository) GetEvaluationHistory(ctx context.Context, baselineID string, tenantID string) ([]models.Evaluation, error) {
	var evaluations []models.Evaluation
	err := r.db.SelectContext(ctx, &evaluations,
		`SELECT id, tenant_id, baseline_id, value, status, timestamp, created_at
		 FROM evaluations WHERE baseline_id=$1 AND tenant_id=$2 ORDER BY timestamp DESC`,
		baselineID, tenantID)
	if err != nil {
		return nil, err
	}
	if evaluations == nil {
		evaluations = []models.Evaluation{}
	}
	return evaluations, nil
}

// RecordEvaluation returns the row it just inserted. The service used to build
// its own reply with no ID, no baseline_id and no timestamp -- a record that
// matched nothing in the database -- so returning the stored row is what makes
// POST /performance/evaluate traceable to a row.
func (r *Repository) RecordEvaluation(ctx context.Context, tenantID, baselineID string, value float64, status string) (*models.Evaluation, error) {
	now := time.Now().UTC()
	e := &models.Evaluation{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		BaselineID: baselineID,
		Value:      value,
		Status:     status,
		Timestamp:  now,
		CreatedAt:  now,
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO evaluations (id, tenant_id, baseline_id, value, status, timestamp, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		e.ID, e.TenantID, e.BaselineID, e.Value, e.Status, e.Timestamp, e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *Repository) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	var p models.Profile
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, service_name, timestamp, created_at
		 FROM profiles WHERE tenant_id=$1 AND service_name=$2 ORDER BY timestamp DESC LIMIT 1`,
		tenantID, serviceName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

// GetBottlenecks scopes by service_name because that is what the route supplies:
// GET /performance/profile/:serviceName/bottlenecks. It used to bind that path
// value into profile_id, a UUID column, so the WHERE clause could never match
// and the endpoint was structurally incapable of returning a row.
func (r *Repository) GetBottlenecks(ctx context.Context, tenantID, serviceName string) ([]models.Bottleneck, error) {
	var bottlenecks []models.Bottleneck
	err := r.db.SelectContext(ctx, &bottlenecks,
		`SELECT id, profile_id, service_name, type, description, score
		 FROM performance_bottlenecks WHERE service_name=$1 AND tenant_id=$2 ORDER BY score DESC`,
		serviceName, tenantID)
	if err != nil {
		return nil, err
	}
	if bottlenecks == nil {
		bottlenecks = []models.Bottleneck{}
	}
	return bottlenecks, nil
}

func (r *Repository) GetSuggestions(ctx context.Context, tenantID, serviceName string) ([]models.Suggestion, error) {
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

// RecordTestResult hands back the stored row. The handler used to answer
// `{"message":"test result recorded"}` with no identifier, so a client could
// record a run and never correlate it with the list it just populated.
func (r *Repository) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) (*models.TestResult, error) {
	now := time.Now().UTC()
	t := &models.TestResult{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		ServiceName: req.ServiceName,
		TestName:    req.TestName,
		Duration:    req.Duration,
		Status:      req.Status,
		Timestamp:   now,
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO performance_test_results (id, tenant_id, service_name, test_name, duration, status, timestamp)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		t.ID, t.TenantID, t.ServiceName, t.TestName, t.Duration, t.Status, t.Timestamp)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repository) GetTestResults(ctx context.Context, tenantID, serviceName string) ([]models.TestResult, error) {
	var results []models.TestResult
	err := r.db.SelectContext(ctx, &results,
		`SELECT id, tenant_id, service_name, test_name, duration, status, timestamp
		 FROM performance_test_results WHERE tenant_id=$1 AND service_name=$2 ORDER BY timestamp DESC`,
		tenantID, serviceName)
	if err != nil {
		return nil, err
	}
	if results == nil {
		results = []models.TestResult{}
	}
	return results, nil
}
