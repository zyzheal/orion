package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/agents/models"
	"orion/platform-svc-go/internal/ai/agents/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string, filter *repository.ListFilter) (int64, error)
	CreateAgent(ctx context.Context, a *models.AIAgent) error
	CreateAuditLog(ctx context.Context, log *models.AgentAuditLog) error
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	DeleteAuditLogs(ctx context.Context, agentID string, tenantID string) error
	GetAgentStats(ctx context.Context, tenantID string) (*models.AgentStats, error)
	GetAuditLogs(ctx context.Context, agentID string, tenantID string, limit int) ([]models.AgentAuditLog, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.AIAgent, error)
	List(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.AIAgent, error)
	UpdateAgent(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.AIAgent, error)
	UpdateAgentStatus(ctx context.Context, id string, tenantID string, status models.AgentStatus) (*models.AIAgent, error)
}

type Service struct {
	repo     RepositoryInterface
	registry *AgentRegistry
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:     repo,
		registry: NewAgentRegistry(),
	}
}

// WithRegistry replaces the default agent registry on the service.
func (s *Service) WithRegistry(registry *AgentRegistry) {
	if registry != nil {
		s.registry = registry
	}
}

var (
	ErrAgentNotFound  = errors.New("agent not found")
	ErrInputEmpty     = errors.New("agent input must not be empty")
	ErrExecutorFailed = errors.New("agent executor failed")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrAgentNotFound) || errors.Is(err, sql.ErrNoRows)
}

// --- Agents ---

// RegisterAgent creates a new agent in the registry.
func (s *Service) RegisterAgent(ctx context.Context, tenantID, userID string, req *models.RegisterAgentRequest) (*models.AIAgent, error) {
	// Marshal JSONB columns
	toolsJSON, err := json.Marshal(req.RequiredTools)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal required tools: %w", err)
	}
	permsJSON, err := json.Marshal(req.RequiredPermissions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal required permissions: %w", err)
	}

	var modelConfigJSON sql.NullString
	if req.ModelConfig != nil {
		mcJSON, err := json.Marshal(req.ModelConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal model config: %w", err)
		}
		modelConfigJSON = sql.NullString{String: string(mcJSON), Valid: true}
	}

	now := time.Now().Unix()

	a := &models.AIAgent{
		TenantID:            tenantID,
		Name:                req.Name,
		Enabled:             req.Enabled,
		Scenario:            req.Scenario,
		Provider:            req.Provider,
		MaxConcurrency:      req.MaxConcurrency,
		TimeoutMs:           req.TimeoutMs,
		MaxRetries:          req.MaxRetries,
		BackoffMs:           req.BackoffMs,
		RequiredTools:       string(toolsJSON),
		RequiredPermissions: string(permsJSON),
		ModelConfig:         modelConfigJSON,
		Status:              models.AgentStatusIdle,
		CreatedBy:           userID,
		CreatedAt:           now,
	}

	err = s.repo.CreateAgent(ctx, a)
	if err != nil {
		return nil, err
	}
	return a, nil
}

// GetAgent retrieves an agent by its ID.
func (s *Service) GetAgent(ctx context.Context, id string, tenantID string) (*models.AIAgent, error) {
	a, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrAgentNotFound
	}
	return a, nil
}

// ListAgents returns paginated list of agents for the tenant.
func (s *Service) ListAgents(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.AIAgent, error) {
	agents, err := s.repo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}
	return agents, nil
}

// CountAgents returns total count of agents matching the filter.
func (s *Service) CountAgents(ctx context.Context, tenantID string, filter *repository.ListFilter) (int64, error) {
	return s.repo.Count(ctx, tenantID, filter)
}

// UpdateAgent partially updates an agent's fields.
func (s *Service) UpdateAgent(ctx context.Context, id string, tenantID string, req *models.UpdateAgentRequest) (*models.AIAgent, error) {
	// Verify agent exists first
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrAgentNotFound
	}

	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Scenario != nil {
		updates["scenario"] = *req.Scenario
	}
	if req.Provider != nil {
		updates["provider"] = *req.Provider
	}
	if req.MaxConcurrency != nil {
		updates["max_concurrency"] = *req.MaxConcurrency
	}
	if req.TimeoutMs != nil {
		updates["timeout_ms"] = *req.TimeoutMs
	}
	if req.MaxRetries != nil {
		updates["max_retries"] = *req.MaxRetries
	}
	if req.BackoffMs != nil {
		updates["backoff_ms"] = *req.BackoffMs
	}
	if req.RequiredTools != nil {
		b, err := json.Marshal(*req.RequiredTools)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal required tools: %w", err)
		}
		updates["required_tools"] = string(b)
	}
	if req.RequiredPermissions != nil {
		b, err := json.Marshal(*req.RequiredPermissions)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal required permissions: %w", err)
		}
		updates["required_permissions"] = string(b)
	}
	if req.ModelConfig != nil {
		b, err := json.Marshal(req.ModelConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal model config: %w", err)
		}
		updates["model_config"] = string(b)
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	agent, err := s.repo.UpdateAgent(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return agent, nil
}

// UpdateAgentStatus updates the running status of an agent.
func (s *Service) UpdateAgentStatus(ctx context.Context, id string, tenantID string, status models.AgentStatus) (*models.AIAgent, error) {
	agent, err := s.repo.UpdateAgentStatus(ctx, id, tenantID, status)
	if err != nil {
		return nil, ErrAgentNotFound
	}
	return agent, nil
}

// DeleteAgent removes an agent and its audit logs.
func (s *Service) DeleteAgent(ctx context.Context, id string, tenantID string) (bool, error) {
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return false, ErrAgentNotFound
	}

	err = s.repo.DeleteAuditLogs(ctx, id, tenantID)
	if err != nil {
		return false, fmt.Errorf("failed to delete audit logs: %w", err)
	}

	return s.repo.Delete(ctx, id, tenantID)
}

// --- Audit Logs ---

// GetAuditLogs returns execution audit logs for an agent.
func (s *Service) GetAuditLogs(ctx context.Context, agentID string, tenantID string, limit int) ([]models.AgentAuditLog, error) {
	logs, err := s.repo.GetAuditLogs(ctx, agentID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	return logs, nil
}

// RecordAuditLog creates a new audit log entry.
func (s *Service) RecordAuditLog(ctx context.Context, tenantID string, log *models.AgentAuditLog) error {
	log.TenantID = tenantID
	return s.repo.CreateAuditLog(ctx, log)
}

// --- Stats ---

// GetAgentStats returns aggregated agent statistics for the tenant.
func (s *Service) GetAgentStats(ctx context.Context, tenantID string) (*models.AgentStats, error) {
	return s.repo.GetAgentStats(ctx, tenantID)
}

// --- Execution ---

// ExecuteAgent dispatches execution to the appropriate AgentExecutor via
// the AgentRegistry based on the agent's scenario. Falls back to the
// generic executor for unknown scenarios.
func (s *Service) ExecuteAgent(ctx context.Context, agentID string, tenantID string, req *models.ExecuteAgentRequest) (*models.ExecuteAgentResult, error) {
	// Verify the agent exists and is enabled
	agent, err := s.repo.GetByID(ctx, agentID, tenantID)
	if err != nil {
		return nil, ErrAgentNotFound
	}
	if !agent.Enabled {
		return nil, fmt.Errorf("agent %s is disabled", agentID)
	}

	// Status transition: idle -> running
	_, err = s.repo.UpdateAgentStatus(ctx, agentID, tenantID, models.AgentStatusRunning)
	if err != nil {
		return nil, fmt.Errorf("failed to set agent running: %w", err)
	}

	start := time.Now()
	var execErr error

	// Dispatch execution through the AgentRegistry by agent scenario.
	execResult, execErr := s.registry.Dispatch(ctx, agent, req.Input)

	elapsed := int(time.Since(start).Milliseconds())

	var result *models.ExecuteAgentResult
	if execErr != nil {
		executionErr := execErr.Error()
		result = &models.ExecuteAgentResult{
			Success:    false,
			Error:      executionErr,
			DurationMs: elapsed,
			TokenUsage: &models.AgentTokenUsage{Input: 0, Output: 0, Total: 0},
		}
		// Revert to error status
		_, _ = s.repo.UpdateAgentStatus(ctx, agentID, tenantID, models.AgentStatusError)
	} else {
		result = &models.ExecuteAgentResult{
			Success:    execResult.Success,
			Data:       execResult.Data,
			Error:      execResult.Error,
			DurationMs: elapsed,
			TokenUsage: execResult.TokenUsage,
		}
		// Revert to idle on success
		_, _ = s.repo.UpdateAgentStatus(ctx, agentID, tenantID, models.AgentStatusIdle)
	}

	// Persist audit log with execution result
	contextMap := map[string]interface{}{
		"traceId":  req.TraceID,
		"userId":   req.UserID,
		"tenantId": tenantID,
		"scenario": agent.Scenario,
		"provider": agent.Provider,
		"metadata": req.Metadata,
	}
	inputJSON, _ := json.Marshal(req.Input)
	outputJSON, _ := json.Marshal(result)

	err = s.RecordAuditLog(ctx, tenantID, &models.AgentAuditLog{
		AgentID:      agentID,
		Context:      string(mustJSON(contextMap)),
		Input:        string(inputJSON),
		Output:       string(outputJSON),
		DurationMs:   elapsed,
		InputTokens:  0,
		OutputTokens: 0,
		TotalTokens:  0,
		Success:      result.Success,
		Error:        sql.NullString{String: result.Error, Valid: result.Error != ""},
		CreatedAt:    time.Now().Unix(),
	})
	if err != nil {
		// Non-fatal: execution result already computed, audit log is best-effort
	}

	return result, execErr
}

// AgentToInfo converts a database AIAgent to the API-facing AgentInfo.
func (s *Service) AgentToInfo(a *models.AIAgent) (*models.AgentInfo, error) {
	info := &models.AgentInfo{
		ID:             a.ID,
		Name:           a.Name,
		Enabled:        a.Enabled,
		Scenario:       a.Scenario,
		Provider:       a.Provider,
		Status:         a.Status,
		MaxConcurrency: a.MaxConcurrency,
		CreatedAt:      a.CreatedAt,
	}
	if a.ModelConfig.Valid {
		var mc models.ModelConfig
		if err := json.Unmarshal([]byte(a.ModelConfig.String), &mc); err == nil {
			info.ModelConfig = &mc
		}
	}
	return info, nil
}

// AgentAuditLogToResponse converts a database audit log to the API response format.
func (s *Service) AgentAuditLogToResponse(log *models.AgentAuditLog) (*models.AgentAuditLogResponse, error) {
	resp := &models.AgentAuditLogResponse{
		ID:         log.ID,
		AgentID:    log.AgentID,
		DurationMs: log.DurationMs,
		Success:    log.Success,
		Error:      log.Error.String,
		CreatedAt:  log.CreatedAt,
	}
	if log.Context != "" {
		var ctx map[string]interface{}
		if err := json.Unmarshal([]byte(log.Context), &ctx); err == nil {
			resp.Context = ctx
		}
	}
	if log.Input != "" {
		var input map[string]interface{}
		if err := json.Unmarshal([]byte(log.Input), &input); err == nil {
			resp.Input = input
		}
	}
	if log.Output != "" {
		var output map[string]interface{}
		if err := json.Unmarshal([]byte(log.Output), &output); err == nil {
			resp.Output = output
		}
	}
	resp.TokenUsage = models.AgentTokenUsage{
		Input:  log.InputTokens,
		Output: log.OutputTokens,
		Total:  log.TotalTokens,
	}
	return resp, nil
}

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
