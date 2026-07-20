package service

import "encoding/json"

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountPlans(ctx context.Context, tenantID string) (int, error)
	CreatePlan(ctx context.Context, p *models.DisasterPlan) error
	CreateRun(ctx context.Context, run *models.RecoveryRun) error
	GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error)
	GetRun(ctx context.Context, tenantID, planID, runID string) (*models.RecoveryRun, error)
	ListPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.DisasterPlan, error)
	ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error)
	UpdatePlan(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePlanLastRun(ctx context.Context, tenantID, id string, lastRun time.Time) error
}

var (
	ErrNotFound      = errors.New("disaster plan not found")
	ErrAlreadyExists = errors.New("disaster plan already exists")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreatePlan(ctx context.Context, tenantID string, req models.CreateDisasterPlanRequest) (*models.DisasterPlan, error) {
	stepsJSON, _ := json.Marshal(req.Steps)
	p := &models.DisasterPlan{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Steps:       string(stepsJSON),
		Status:      "active",
		LastRun:     time.Time{},
	}
	if err := s.repo.CreatePlan(ctx, p); err != nil {
		return nil, err
	}
	return s.repo.GetPlan(ctx, tenantID, p.ID)
}

func (s *Service) GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error) {
	return s.repo.GetPlan(ctx, tenantID, id)
}

func (s *Service) ListPlans(ctx context.Context, tenantID string, limit, offset int) (*models.ListPlansResponse, error) {
	plans, err := s.repo.ListPlans(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountPlans(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ListPlansResponse{Plans: plans, Total: total}, nil
}

func (s *Service) UpdatePlan(ctx context.Context, tenantID, id string, req models.UpdateDisasterPlanRequest) (*models.DisasterPlan, error) {
	_, err := s.repo.GetPlan(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Steps != nil {
		updates["steps"] = req.Steps
	}
	if err := s.repo.UpdatePlan(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetPlan(ctx, tenantID, id)
}

func (s *Service) RunPlan(ctx context.Context, tenantID, planID string) (*models.RecoveryRun, error) {
	_, err := s.repo.GetPlan(ctx, tenantID, planID)
	if err != nil {
		return nil, ErrNotFound
	}
	now := time.Now().UTC()
	run := &models.RecoveryRun{
		PlanID:    planID,
		Status:    "running",
		StartedAt: now,
		EndedAt:   time.Time{},
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}
	if err := s.repo.UpdatePlanLastRun(ctx, tenantID, planID, now); err != nil {
		return nil, err
	}
	return s.repo.GetRun(ctx, tenantID, planID, run.ID)
}

func (s *Service) ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error) {
	return s.repo.ListRuns(ctx, tenantID, planID)
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}
