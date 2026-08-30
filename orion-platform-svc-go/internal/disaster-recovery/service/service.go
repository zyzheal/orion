package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/orchestrator"
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
	ErrAlreadyExists = errors.New("disaster plan already exists")
)

type Service struct {
	repo RepositoryInterface
	orch *orchestrator.DROrchestrator
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// SetOrchestrator injects the DR orchestrator for real failover execution.
// When set, RunPlan will invoke the orchestrator's ExecuteSteps to actually
// run the plan's steps instead of just recording a "running" status.
func (s *Service) SetOrchestrator(orch *orchestrator.DROrchestrator) {
	s.orch = orch
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
		return nil, sentinel.NotFound
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
	plan, err := s.repo.GetPlan(ctx, tenantID, planID)
	if err != nil {
		return nil, sentinel.NotFound
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

	// If an orchestrator is injected, actually execute the plan's steps.
	if s.orch != nil {
		drSteps := convertSteps(plan.Steps)
		result, _ := s.orch.ExecuteSteps(ctx, planID, drSteps, true)
		end := time.Now().UTC()
		run.Status = result.Status
		run.EndedAt = end
		// Persist the updated run status.
		_ = s.repo.CreateRun(ctx, run)
	}

	return s.repo.GetRun(ctx, tenantID, planID, run.ID)
}

// convertSteps converts a JSON-encoded []string steps column into a slice of
// orchestrator.DRStep objects. Each string becomes a DRStep with the string as
// its Command, a default preflight phase, 60-second timeout, and auto-rollback.
func convertSteps(stepsJSON string) []orchestrator.DRStep {
	var raw []string
	if err := json.Unmarshal([]byte(stepsJSON), &raw); err != nil {
		return nil
	}
	steps := make([]orchestrator.DRStep, 0, len(raw))
	for i, cmd := range raw {
		steps = append(steps, orchestrator.DRStep{
			ID:          fmt.Sprintf("step-%d", i+1),
			Name:        fmt.Sprintf("Step %d: %s", i+1, truncate(cmd, 64)),
			Phase:       orchestrator.PhasePreflight,
			Command:     cmd,
			Timeout:     60 * time.Second,
			OnFail:      "abort",
			MaxRetries:  1,
		})
	}
	return steps
}

// truncate shortens a string to n characters, appending "…" if truncated.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func (s *Service) ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error) {
	return s.repo.ListRuns(ctx, tenantID, planID)
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}
