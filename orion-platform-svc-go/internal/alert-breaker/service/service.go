package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/alert-breaker/evaluator"
	"orion/platform-svc-go/internal/alert-breaker/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, a *models.AlertBreaker) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error)
	List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error)
	Update(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.AlertBreaker, error)
}

type Service struct {
	repo      RepositoryInterface
	evaluator *evaluator.Evaluator
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// NewServiceWithEvaluator constructs a Service that has both the CRUD repo
// and the evaluator wired in. evaluator may be nil (the service then
// returns ErrNoEvaluator on Evaluate calls); this keeps existing call
// sites (NewService(repo)) source-compatible.
func NewServiceWithEvaluator(repo RepositoryInterface, ev *evaluator.Evaluator) *Service {
	return &Service{repo: repo, evaluator: ev}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateAlertBreakerRequest) (*models.AlertBreaker, error) {
	a := &models.AlertBreaker{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		AlertID:     req.AlertID,
		Rule:        req.Rule,
		Status:      "active",
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateAlertBreakerRequest) (*models.AlertBreaker, error) {
	fields := make(map[string]interface{})
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if req.Rule != nil {
		fields["rule"] = req.Rule
	}
	return s.repo.Update(ctx, tenantID, id, fields)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// ErrNoEvaluator is returned when Service.Evaluate is called but no
// evaluator was wired at construction time.
var ErrNoEvaluator = errors.New("service: evaluator not wired")

// Evaluate decides whether an alert should be broken (suppressed).
// Delegates to the wired evaluator; returns ErrNoEvaluator if none was
// injected. tenantID is used for state scoping (ADR-0004).
func (s *Service) Evaluate(ctx context.Context, tenantID string, req *models.EvaluateAlertRequest) (*models.EvaluateAlertResponse, error) {
	if s.evaluator == nil {
		return nil, ErrNoEvaluator
	}
	res, err := s.evaluator.Evaluate(ctx, &evaluator.EvaluationInput{
		TenantID:    tenantID,
		PolicyID:    req.PolicyID,
		AlertID:     req.AlertID,
		Fingerprint: req.Fingerprint,
		Rule:        req.Rule,
	})
	if err != nil {
		return nil, err
	}
	return &models.EvaluateAlertResponse{
		Broken:      res.Broken,
		Count:       res.Count,
		WindowStart: res.WindowStart,
		WindowEnd:   res.WindowEnd,
		Threshold:   res.Threshold,
		Reason:      res.Reason,
	}, nil
}
