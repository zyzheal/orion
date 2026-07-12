package service

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/chaos/models"
	"orion/platform-svc-go/internal/chaos/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Experiment CRUD ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
	m := &models.Experiment{
		TenantID:              tenantID,
		Name:                  req.Name,
		Description:           req.Description,
		Scope:                 req.Scope,
		Faults:                req.Faults,
		SteadyStateHypothesis: req.SteadyStateHypothesis,
		AutoRollback:          req.AutoRollback,
		CreatedBy:             req.CreatedBy,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error) {
	return s.repo.List(ctx, tenantID, status, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateExperimentRequest) (*models.Experiment, error) {
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
	if req.Faults != nil {
		updates["faults"] = *req.Faults
	}
	if len(updates) == 0 {
		return s.repo.GetByID(ctx, tenantID, id)
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Experiment Activation ---

// ActivateExperiment marks an experiment as active.
func (s *Service) ActivateExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// ArchiveExperiment marks an experiment as archived.
func (s *Service) ArchiveExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "archived"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// --- Experiment Execution ---

// RunExperiment starts a new run for an experiment.
func (s *Service) RunExperiment(ctx context.Context, tenantID, id string, req models.RunExperimentRequest) (*models.ExperimentRun, error) {
	// Verify experiment exists
	experiment, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrNotFound)
	}
	_ = experiment // experiment is validated

	run := &models.ExperimentRun{
		TenantID:     tenantID,
		ExperimentID: id,
		Status:       "running",
		Reason:       req.Reason,
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}
	return run, nil
}

// GetRun retrieves a run by ID.
func (s *Service) GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	return s.repo.GetRun(ctx, tenantID, runID)
}

// RollbackRun rolls back a run.
func (s *Service) RollbackRun(ctx context.Context, tenantID, runID string, reason string) (*models.ExperimentRun, error) {
	if err := s.repo.UpdateRunStatus(ctx, tenantID, runID, "rolled_back"); err != nil {
		return nil, err
	}
	return s.repo.GetRun(ctx, tenantID, runID)
}

// --- Running Experiments ---

// GetRunningExperiments returns all currently running experiments.
func (s *Service) GetRunningExperiments(ctx context.Context, tenantID string) ([]models.Experiment, error) {
	return s.repo.ListRunning(ctx, tenantID)
}

// --- Fault Injection (Direct) ---

// ExecuteCPUSpike injects a CPU spike fault.
func (s *Service) ExecuteCPUSpike(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	// TODO: implement actual CPU spike injection via executor.
	return &models.InjectResult{
		InjectionID: "cpu-" + target,
		Target:      target,
		Status:      "injected",
	}, nil
}

// ExecuteMemoryLeak injects a memory leak fault.
func (s *Service) ExecuteMemoryLeak(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	// TODO: implement actual memory leak injection.
	return &models.InjectResult{
		InjectionID: "mem-" + target,
		Target:      target,
		Status:      "injected",
	}, nil
}

// ExecuteNetworkLatency injects a network latency fault.
func (s *Service) ExecuteNetworkLatency(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	// TODO: implement actual network latency injection.
	return &models.InjectResult{
		InjectionID: "net-" + target,
		Target:      target,
		Status:      "injected",
	}, nil
}

// ExecuteServiceDown injects a service down fault.
func (s *Service) ExecuteServiceDown(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	// TODO: implement actual service down injection.
	return &models.InjectResult{
		InjectionID: "svc-" + target,
		Target:      target,
		Status:      "injected",
	}, nil
}

// --- Recovery ---

// RecoverExperiment triggers recovery for an experiment.
func (s *Service) RecoverExperiment(ctx context.Context, tenantID, experimentID string) (*models.RecoveryResult, error) {
	// TODO: implement actual recovery logic.
	return &models.RecoveryResult{
		ExperimentID: experimentID,
		Status:       "recovered",
		Message:      "experiment recovery completed",
	}, nil
}

// ValidateRecovery validates recovery after an experiment.
func (s *Service) ValidateRecovery(ctx context.Context, tenantID, experimentID string) (*models.RecoveryValidation, error) {
	// TODO: implement actual recovery validation.
	return &models.RecoveryValidation{
		ExperimentID: experimentID,
		Passed:       true,
		Details:      "all services healthy after recovery",
	}, nil
}

// GenerateRecoveryReport generates a recovery report for an experiment.
func (s *Service) GenerateRecoveryReport(ctx context.Context, tenantID, experimentID string) (*models.RecoveryReport, error) {
	// TODO: implement actual recovery report generation.
	return &models.RecoveryReport{
		ExperimentID: experimentID,
		Report:       "recovery completed successfully for " + experimentID,
	}, nil
}

// --- Pre-release Verify ---

// PreReleaseVerify runs pre-release verification for a service.
func (s *Service) PreReleaseVerify(ctx context.Context, tenantID string, req models.PreReleaseVerifyRequest) (*models.PreReleaseVerifyResult, error) {
	// TODO: implement actual pre-release verification.
	return &models.PreReleaseVerifyResult{
		ServiceID:   req.ServiceID,
		Environment: req.Environment,
		Status:      "passed",
		Details:     "pre-release verification completed",
	}, nil
}

// --- Errors ---

var (
	ErrNotFound = errors.New("experiment not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
