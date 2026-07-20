package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/chaos/models"
)

// --- Experiment CRUD ------------------------------------------------

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	m := &models.Experiment{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		FaultType:    req.FaultType,
		Scope:        req.Scope,
		Target:       req.Target,
		TargetFilter: req.TargetFilter,
		SteadyStateHypothesis: req.SteadyStateHypothesis,
		RollbackStrategy:        req.RollbackStrategy,
		CreatedBy:    req.CreatedBy,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
		Status:       "inactive",
		AutoRollback: true,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, fmt.Errorf("create experiment: %w", err)
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if tenantID == "" || id == "" {
		return nil, errors.New("tenant_id and id are required")
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	return s.repo.List(ctx, tenantID, status, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateExperimentRequest) (*models.Experiment, error) {
	if tenantID == "" || id == "" {
		return nil, errors.New("tenant_id and id are required")
	}
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Scope != nil {
		updates["scope"] = *req.Scope
	}
	if req.TargetFilter != nil {
		updates["target_filter"] = *req.TargetFilter
	}
	if len(updates) == 0 {
		return s.repo.GetByID(ctx, tenantID, id)
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, fmt.Errorf("update experiment: %w", err)
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return errors.New("tenant_id and id are required")
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Experiment Activation ------------------------------------------

func (s *Service) ActivateExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if tenantID == "" || id == "" {
		return nil, errors.New("tenant_id and id are required")
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, fmt.Errorf("activate experiment: %w", err)
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ArchiveExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if tenantID == "" || id == "" {
		return nil, errors.New("tenant_id and id are required")
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "archived"); err != nil {
		return nil, fmt.Errorf("archive experiment: %w", err)
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// --- Experiment Execution -------------------------------------------

func (s *Service) RunExperiment(ctx context.Context, tenantID, id string, req models.RunExperimentRequest) (*models.ExperimentRun, error) {
	if tenantID == "" || id == "" {
		return nil, errors.New("tenant_id and id are required")
	}
	// Verify experiment exists
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", sentinel.NotFound)
	}

	run := &models.ExperimentRun{
		TenantID:     tenantID,
		ExperimentID: id,
		Status:       "running",
		CreatedBy:    req.CreatedBy,
		CreatedAt:    time.Now().UTC(),
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}
	return run, nil
}

func (s *Service) GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	if tenantID == "" || runID == "" {
		return nil, errors.New("tenant_id and run_id are required")
	}
	return s.repo.GetRun(ctx, tenantID, runID)
}

func (s *Service) RollbackRun(ctx context.Context, tenantID, runID string, reason string) (*models.ExperimentRun, error) {
	if tenantID == "" || runID == "" {
		return nil, errors.New("tenant_id and run_id are required")
	}
	if err := s.repo.UpdateRunStatus(ctx, tenantID, runID, "rolled_back"); err != nil {
		return nil, fmt.Errorf("rollback run: %w", err)
	}
	run, err := s.repo.GetRun(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	// TODO: persist reason to run record when supported.
	_ = reason
	return run, nil
}

// --- Running Experiments --------------------------------------------

func (s *Service) GetRunningExperiments(ctx context.Context, tenantID string) ([]models.Experiment, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	return s.repo.ListRunning(ctx, tenantID)
}
