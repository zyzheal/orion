package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/platform-svc-go/internal/ai/llm-provider"
	"orion/platform-svc-go/internal/ai/orchestration/engine"
	"orion/platform-svc-go/internal/ai/orchestration/models"
	"orion/platform-svc-go/internal/ai/orchestration/repository"
	"go.uber.org/zap"
)

// OrchestrationService orchestrates multi-agent DAG execution.
type OrchestrationService struct {
	repo     *repository.OrchestrationRepository
	logger   *zap.Logger
	registry *llmprovider.ProviderRegistry
	orch     *engine.Orchestrator
}

// ServiceOption configures the OrchestrationService.
type ServiceOption func(*OrchestrationService)

// WithProviderRegistry wires an LLM ProviderRegistry into the service.
func WithProviderRegistry(reg *llmprovider.ProviderRegistry) ServiceOption {
	return func(s *OrchestrationService) {
		s.registry = reg
		s.orch = engine.NewOrchestrator(reg, s.logger)
	}
}

// NewOrchestrationService creates the orchestration service.
func NewOrchestrationService(
	repo *repository.OrchestrationRepository,
	logger *zap.Logger,
	opts ...ServiceOption,
) *OrchestrationService {
	s := &OrchestrationService{repo: repo, logger: logger}
	for _, opt := range opts {
		opt(s)
	}
	// Always create an orchestrator; nil registry means dry-run mode.
	if s.orch == nil {
		s.orch = engine.NewOrchestrator(nil, logger)
	}
	return s
}

// RegisterTool registers a callable tool available to all LLM nodes.
func (s *OrchestrationService) RegisterTool(name string, fn engine.ToolFn) {
	if s.orch != nil {
		s.orch.RegisterTool(name, fn)
	}
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

// Run executes an orchestration by running the agent DAG through the
// engine.orchestrator and persists the final result.
func (s *OrchestrationService) Run(ctx context.Context, tenantID string, req *models.RunRequest) (*models.OrchestrationRun, error) {
	// Validate orchestration.
	orch, err := s.repo.Get(ctx, tenantID, req.OrchestrationID)
	if err != nil {
		return nil, fmt.Errorf("orchestration not found: %s", req.OrchestrationID)
	}
	if orch.Status != "active" {
		return nil, fmt.Errorf("orchestration is not active: %s", orch.Status)
	}

	// Create run record.
	inputJSON, _ := json.Marshal(req.Input)
	run, err := s.repo.CreateRun(ctx, req.OrchestrationID, string(inputJSON))
	if err != nil {
		s.logger.Error("failed to create orchestration run",
			zap.String("orchId", orch.ID),
			zap.Error(err),
		)
		return nil, err
	}

	// Build the OrchestrationDAG from the persisted model.
	dag := s.buildDAG(orch, req.Options)

	// Execute via the orchestrator engine.
	result := s.orch.Execute(ctx, dag, req.Input, engine.NewRunOptions(req.Options.TimeoutSec, req.Options.MaxSteps, req.Options.Parallel, req.Options.DryRun))

	// Persist the result.
	outputJSON, _ := json.Marshal(result)
	var errMsg string
	if result.Error != "" {
		errMsg = result.Error
	}
	if err := s.repo.UpdateRun(ctx, run.ID, result.Status, string(outputJSON), errMsg); err != nil {
		s.logger.Error("failed to update run result",
			zap.String("runId", run.ID),
			zap.Error(err),
		)
	}

	// Update run object to reflect final state.
	run.Status = result.Status
	run.Output = string(outputJSON)
	run.Error = errMsg

	s.logger.Info("orchestration run completed",
		zap.String("runId", run.ID),
		zap.String("orchId", orch.ID),
		zap.String("status", result.Status),
		zap.Int("nodesExecuted", len(result.NodeResults)),
	)
	return run, nil
}

// buildDAG converts the persisted Orchestration model into an engine DAG.
func (s *OrchestrationService) buildDAG(orch *models.Orchestration, opts models.RunOptions) *engine.OrchestrationDAG {
	agentNodes := make([]engine.AgentNode, 0, len(orch.Agents))
	for i := range orch.Agents {
		ac := &orch.Agents[i]
		n := engine.AgentNode{
			ID:     ac.ID,
			Name:   ac.Name,
			Type:   engine.AgentType(ac.Type),
			Inputs: map[string]interface{}{
				"capabilities": ac.Capabilities,
				"config":       ac.Config,
			},
		}
		// Default type mapping: unrecognized types → LLM_CHAT.
		if n.Type == "" {
			n.Type = engine.AgentTypeLLMChat
		}
		agentNodes = append(agentNodes, n)
	}

	// Build a linear DAG (edges from i → i+1) if no explicit edges exist.
	edges := make([]engine.DAGEdge, 0, len(agentNodes)-1)
	for i := 0; i < len(agentNodes)-1; i++ {
		edges = append(edges, engine.DAGEdge{
			From: agentNodes[i].ID,
			To:   agentNodes[i+1].ID,
		})
	}

	maxSteps := opts.MaxSteps
	if maxSteps == 0 {
		maxSteps = len(agentNodes) * 3
	}

	return &engine.OrchestrationDAG{
		ID:          orch.ID,
		Name:        orch.Name,
		Description: orch.Description,
		DAG: engine.DAG{
			Nodes: agentNodes,
			Edges: edges,
		},
		MaxSteps: maxSteps,
		TimeoutSec: opts.TimeoutSec,
	}
}

// GetRunResult returns the engine run result for a completed run by ID.
func (s *OrchestrationService) GetRunResult(ctx context.Context, id string) (*engine.RunResult, error) {
	run, err := s.repo.GetRun(ctx, id)
	if err != nil {
		return nil, err
	}
	var result engine.RunResult
	if run.Output == "" {
		return nil, fmt.Errorf("run %s has no output", id)
	}
	if err := json.Unmarshal([]byte(run.Output), &result); err != nil {
		return nil, fmt.Errorf("failed to parse run output: %w", err)
	}
	return &result, nil
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
