package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/platform-svc-go/internal/ai/orchestration/models"
	"orion/platform-svc-go/internal/ai/orchestration/repository"
	"go.uber.org/zap"
)

type OrchestrationService struct {
	repo   *repository.OrchestrationRepository
	logger *zap.Logger
}

func NewOrchestrationService(repo *repository.OrchestrationRepository, logger *zap.Logger) *OrchestrationService {
	return &OrchestrationService{repo: repo, logger: logger}
}

// Create creates a new orchestration.
func (s *OrchestrationService) Create(ctx context.Context, tenantID string, name, description string, agents []models.AgentConfig) (*models.Orchestration, error) {
	if len(agents) == 0 {
		return nil, fmt.Errorf("at least one agent is required")
	}

	orch, err := s.repo.Create(ctx, tenantID, name, description, agents)
	if err != nil {
		s.logger.Error("failed to create orchestration",
			zap.String("name", name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("orchestration created",
		zap.String("orchId", orch.ID),
		zap.String("name", orch.Name),
		zap.Int("agentCount", len(agents)),
	)
	return orch, nil
}

// Query returns paginated orchestrations.
func (s *OrchestrationService) Query(ctx context.Context, tenantID string, limit, offset int) (models.OrchestrationResponse, error) {
	return s.repo.Query(ctx, tenantID, limit, offset)
}

// Get returns a single orchestration.
func (s *OrchestrationService) Get(ctx context.Context, tenantID, id string) (*models.Orchestration, error) {
	return s.repo.Get(ctx, tenantID, id)
}

// Run executes an orchestration.
func (s *OrchestrationService) Run(ctx context.Context, tenantID string, req *models.RunRequest) (*models.OrchestrationRun, error) {
	// Validate orchestration
	orch, err := s.repo.Get(ctx, tenantID, req.OrchestrationID)
	if err != nil {
		return nil, fmt.Errorf("orchestration not found: %s", req.OrchestrationID)
	}
	if orch.Status != "active" {
		return nil, fmt.Errorf("orchestration is not active: %s", orch.Status)
	}

	// Create run
	inputJSON, _ := json.Marshal(req.Input)
	run, err := s.repo.CreateRun(ctx, req.OrchestrationID, string(inputJSON))
	if err != nil {
		s.logger.Error("failed to create orchestration run",
			zap.String("orchId", orch.ID),
			zap.Error(err),
		)
		return nil, err
	}

	// Execute orchestration (simplified)
	s.executeOrchestration(ctx, orch, run, req.Options)

	s.logger.Info("orchestration run completed",
		zap.String("runId", run.ID),
		zap.String("orchId", orch.ID),
	)
	return run, nil
}

func (s *OrchestrationService) executeOrchestration(ctx context.Context, orch *models.Orchestration, run *models.OrchestrationRun, opts models.RunOptions) {
	// Simplified execution: run agents in sequence or parallel
	for _, agent := range orch.Agents {
		s.logger.Info("executing agent in orchestration",
			zap.String("agentId", agent.ID),
			zap.String("agentType", agent.Type),
			zap.String("runId", run.ID),
		)
	}

	// Update run as completed
	_ = s.repo.UpdateRun(ctx, run.ID, "completed", fmt.Sprintf(`{"agents_executed": %d}`, len(orch.Agents)), "")
}

// QueryRuns returns paginated runs.
func (s *OrchestrationService) QueryRuns(ctx context.Context, orchestrationID string, limit, offset int) ([]models.OrchestrationRun, int64, error) {
	return s.repo.QueryRuns(ctx, orchestrationID, limit, offset)
}

// GetRun returns a single run.
func (s *OrchestrationService) GetRun(ctx context.Context, id string) (*models.OrchestrationRun, error) {
	return s.repo.GetRun(ctx, id)
}

// Delete removes an orchestration.
func (s *OrchestrationService) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete orchestration",
			zap.String("orchId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("orchestration deleted", zap.String("orchId", id))
	return nil
}
