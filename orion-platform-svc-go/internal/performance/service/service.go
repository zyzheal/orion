package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/performance/models"
	"orion/platform-svc-go/internal/performance/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateBaseline(ctx context.Context, tenantID string, b *models.Baseline) (*models.Baseline, error)
	DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error)
	GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error)
	GetBottlenecks(ctx context.Context, tenantID string, profileID string) ([]models.Bottleneck, error)
	GetEvaluationHistory(ctx context.Context, baselineID string, tenantID string) ([]models.Evaluation, error)
	GetSuggestions(ctx context.Context, tenantID string, serviceName string) ([]models.Suggestion, error)
	GetTestResults(ctx context.Context, tenantID string, serviceName string) ([]models.Baseline, error)
	ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error)
	ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error)
	RecordEvaluation(ctx context.Context, tenantID string, baselineID string, value float64, status string) error
	RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) error
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

func (s *Service) EvaluatePerformance(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.Evaluation, error) {
	baseline, err := s.repo.GetBaselineByID(ctx, "", tenantID)
	_ = baseline
	_ = err
	status := "ok"
	if req.Value > 0 {
		// simple threshold check - find matching baseline
		baselines, _ := s.repo.ListBaselines(ctx, tenantID)
		for _, b := range baselines {
			if b.ServiceName == req.ServiceName && b.Metric == req.Metric {
				if req.Value > b.Threshold && b.Threshold > 0 {
					status = "exceeded"
				}
				break
			}
		}
	}
	err = s.repo.RecordEvaluation(ctx, tenantID, "", req.Value, status)
	return &models.Evaluation{
		Value:  req.Value,
		Status: status,
	}, err
}

func (s *Service) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	return s.repo.ProfileService(ctx, tenantID, serviceName)
}

func (s *Service) GetBottlenecks(ctx context.Context, tenantID string, profileID string) ([]models.Bottleneck, error) {
	if profileID == "" {
		return []models.Bottleneck{}, nil
	}
	return s.repo.GetBottlenecks(ctx, tenantID, profileID)
}

func (s *Service) GetSuggestions(ctx context.Context, tenantID string, serviceName string) ([]models.Suggestion, error) {
	return s.repo.GetSuggestions(ctx, tenantID, serviceName)
}

func (s *Service) DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error) {
	return s.repo.DetectRegression(ctx, tenantID, req)
}

func (s *Service) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) error {
	return s.repo.RecordTestResult(ctx, tenantID, req)
}

func (s *Service) GetTestResults(ctx context.Context, tenantID string, serviceName string) ([]models.Baseline, error) {
	return s.repo.GetTestResults(ctx, tenantID, serviceName)
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func _() {
	var _ = sql.ErrNoRows
}
