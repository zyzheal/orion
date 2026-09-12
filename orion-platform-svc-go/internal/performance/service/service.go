package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/performance/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateBaseline(ctx context.Context, tenantID string, b *models.Baseline) (*models.Baseline, error)
	DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error)
	GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error)
	GetBottlenecks(ctx context.Context, tenantID, serviceName string) ([]models.Bottleneck, error)
	GetEvaluationHistory(ctx context.Context, baselineID string, tenantID string) ([]models.Evaluation, error)
	GetSuggestions(ctx context.Context, tenantID, serviceName string) ([]models.Suggestion, error)
	GetTestResults(ctx context.Context, tenantID, serviceName string) ([]models.TestResult, error)
	ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error)
	ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error)
	RecordEvaluation(ctx context.Context, tenantID, baselineID string, value float64, status string) (*models.Evaluation, error)
	RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) (*models.TestResult, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateBaseline(ctx context.Context, tenantID string, req *models.CreateBaselineRequest) (*models.Baseline, error) {
	b := &models.Baseline{
		ServiceName: req.ServiceName,
		Metric:      req.Metric,
		Threshold:   req.Threshold,
		WindowDays:  req.WindowDays,
	}
	return s.repo.CreateBaseline(ctx, tenantID, b)
}

func (s *Service) ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error) {
	return s.repo.ListBaselines(ctx, tenantID)
}

func (s *Service) GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error) {
	return s.repo.GetBaselineByID(ctx, id, tenantID)
}

func (s *Service) GetEvaluationHistory(ctx context.Context, id string, tenantID string) ([]models.Evaluation, error) {
	return s.repo.GetEvaluationHistory(ctx, id, tenantID)
}

// EvaluatePerformance scores one measurement against the baseline that owns the
// same service and metric, then records it under that baseline's ID.
//
// It used to pass an empty baseline_id to RecordEvaluation while separately
// issuing GetBaselineByID(ctx, "", tenantID) and discarding both its result and
// its error. The row landed orphaned and GetEvaluationHistory, which filters by
// baseline_id, could never return it: POST /performance/evaluate followed by
// GET /performance/baselines/:id/evaluations was a round trip that always came
// back empty. It also returned an Evaluation with no ID, no baseline_id and no
// timestamp -- a reply that matched no row in the database. Without a matching
// baseline there is nothing to compare against, so that now fails instead of
// writing a meaningless row.
func (s *Service) EvaluatePerformance(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.Evaluation, error) {
	baselines, err := s.repo.ListBaselines(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var baseline *models.Baseline
	for i := range baselines {
		if baselines[i].ServiceName == req.ServiceName && baselines[i].Metric == req.Metric {
			baseline = &baselines[i]
			break
		}
	}
	if baseline == nil {
		return nil, fmt.Errorf("no baseline for service %q metric %q, create one first: %w",
			req.ServiceName, req.Metric, sentinel.NotFound)
	}

	status := models.EvalStatusOK
	if baseline.Threshold > 0 && req.Value > baseline.Threshold {
		status = models.EvalStatusExceeded
	}
	return s.repo.RecordEvaluation(ctx, tenantID, baseline.ID, req.Value, status)
}

func (s *Service) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	return s.repo.ProfileService(ctx, tenantID, serviceName)
}

func (s *Service) GetBottlenecks(ctx context.Context, tenantID, serviceName string) ([]models.Bottleneck, error) {
	if serviceName == "" {
		return []models.Bottleneck{}, nil
	}
	return s.repo.GetBottlenecks(ctx, tenantID, serviceName)
}

func (s *Service) GetSuggestions(ctx context.Context, tenantID string, serviceName string) ([]models.Suggestion, error) {
	return s.repo.GetSuggestions(ctx, tenantID, serviceName)
}

func (s *Service) DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error) {
	return s.repo.DetectRegression(ctx, tenantID, req)
}

func (s *Service) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) (*models.TestResult, error) {
	return s.repo.RecordTestResult(ctx, tenantID, req)
}

func (s *Service) GetTestResults(ctx context.Context, tenantID, serviceName string) ([]models.TestResult, error) {
	return s.repo.GetTestResults(ctx, tenantID, serviceName)
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func _() {
	var _ = sql.ErrNoRows
}
