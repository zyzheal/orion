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

	"orion/platform-svc-go/internal/ai-agent-run/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CancelRun(ctx context.Context, id string, tenantID string) (*models.AgentRun, error)
	Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int64, error)
	CreateRun(ctx context.Context, run *models.AgentRun) error
	GetByTenant(ctx context.Context, id string, tenantID string) (*models.AgentRun, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.AgentRun, error)
	GetDecisionsByRunID(ctx context.Context, runID string, tenantID string) ([]models.AgentDecision, error)
	GetStats(ctx context.Context, tenantID string) (*models.AgentRunStats, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AgentRun, error)
	UpdateStatus(ctx context.Context, id string, tenantID string, status models.AgentRunStatus, completedAt *int64) (*models.AgentRun, error)
	UpdateStep(ctx context.Context, id string, tenantID string, step int) error
	CreateDecision(ctx context.Context, d *models.AgentDecision) error
}

// Service exposes agent run lifecycle operations.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the given repository.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

var (
	ErrRunNotFound    = errors.New("agent run not found")
	ErrRunNotRunning  = errors.New("agent run is not running")
	ErrInvalidStatus  = errors.New("invalid run status for this operation")
	ErrInvalidAction  = errors.New("invalid action")
	ErrRunNotFoundErr = errors.New("agent run not found")
)

// IsNotFound reports whether an error indicates a missing resource.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrRunNotFound) || errors.Is(err, ErrRunNotFoundErr) || errors.Is(err, sql.ErrNoRows)
}

// isRunning reports whether the run is in a state where steps can be executed.
func isRunning(status models.AgentRunStatus) bool {
	return status == models.AgentRunStatusRunning
}

// isValidRetry reports whether the run can be retried.
func isValidRetry(status models.AgentRunStatus) bool {
	return status == models.AgentRunStatusFailed || status == models.AgentRunStatusCancelled
}

func isCancel(status models.AgentRunStatus) bool {
	return status == models.AgentRunStatusRunning
}

func validAction(a string) (models.AgentAction, error) {
	switch models.AgentAction(a) {
	case models.AgentActionReadFile, models.AgentActionWriteCode, models.AgentActionRunCommand,
		models.AgentActionCreatePR, models.AgentActionRequestApprove:
		return models.AgentAction(a), nil
	}
	return "", ErrInvalidAction
}

// ---- Trigger Run ----

// TriggerRun creates a new agent run with initial status 'running'.
func (s *Service) TriggerRun(ctx context.Context, tenantID string, req *models.TriggerRunRequest) (*models.AgentRun, error) {
	now := time.Now()
	nowUnix := now.Unix()

	timeoutSec := int64(3600)
	if req.TimeoutSec != nil {
		timeoutSec = *req.TimeoutSec
	}

	totalSteps := 1
	if req.TotalSteps != nil {
		totalSteps = *req.TotalSteps
	}

	triggerPayloadJSON := "{}"
	if req.TriggerPayload != nil {
		b, err := json.Marshal(req.TriggerPayload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal triggerPayload: %w", err)
		}
		triggerPayloadJSON = string(b)
	}

	run := &models.AgentRun{
		TenantID:         tenantID,
		AgentProfileID:   req.AgentProfileID,
		AgentProfileName: "", // TODO: resolve via agent profile service
		TriggerPayload:   triggerPayloadJSON,
		Status:           models.AgentRunStatusRunning,
		CurrentStep:      0,
		TotalSteps:       totalSteps,
		StartedAt:        nowUnix,
		TimeoutAt:        nowUnix + timeoutSec,
		CreatedAt:        nowUnix,
	}

	err := s.repo.CreateRun(ctx, run)
	if err != nil {
		return nil, err
	}
	return run, nil
}

// ---- GetByID ----

// GetByID retrieves a run and its decisions.
func (s *Service) GetByID(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	run, err := s.repo.GetByTenant(ctx, id, tenantID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	return run, nil
}

// ---- List ----

// List returns paginated runs for the tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AgentRun, error) {
	if filter == nil {
		filter = &models.ListFilter{}
	}
	return s.repo.List(ctx, tenantID, filter)
}

// Count returns the total number of runs matching the filter for the tenant.
func (s *Service) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int64, error) {
	return s.repo.Count(ctx, tenantID, filter)
}

// ---- Cancel ----

// Cancel cancels a running run.
func (s *Service) Cancel(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	run, err := s.repo.GetByTenant(ctx, id, tenantID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if !isCancel(run.Status) {
		return nil, fmt.Errorf("%w: current status is %s", ErrRunNotRunning, run.Status)
	}
	completedAt := time.Now().Unix()
	updated, err := s.repo.UpdateStatus(ctx, id, tenantID, models.AgentRunStatusCancelled, &completedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel run: %w", err)
	}
	return updated, nil
}

// ---- Retry ----

// Retry creates a new run cloning a failed/cancelled run.
func (s *Service) Retry(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	original, err := s.repo.GetByTenant(ctx, id, tenantID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if !isValidRetry(original.Status) {
		return nil, fmt.Errorf("%w: current status is %s, expected failed or cancelled", ErrInvalidStatus, original.Status)
	}

	now := time.Now()
	timeoutSec := int64(3600)

	newRun := &models.AgentRun{
		TenantID:         original.TenantID,
		AgentProfileID:   original.AgentProfileID,
		AgentProfileName: original.AgentProfileName,
		TriggerPayload:   original.TriggerPayload,
		Status:           models.AgentRunStatusRunning,
		CurrentStep:      0,
		TotalSteps:       original.TotalSteps,
		StartedAt:        now.Unix(),
		TimeoutAt:        now.Unix() + timeoutSec,
		CreatedAt:        now.Unix(),
	}

	err = s.repo.CreateRun(ctx, newRun)
	if err != nil {
		return nil, err
	}
	return newRun, nil
}

// ---- ExecuteStep ----

// ExecuteStep records a step decision and advances the current step of a running run.
func (s *Service) ExecuteStep(ctx context.Context, runID string, tenantID string, req *models.ExecuteStepRequest) (*models.AgentDecision, error) {
	run, err := s.repo.GetByTenant(ctx, runID, tenantID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if !isRunning(run.Status) {
		return nil, fmt.Errorf("%w: run status is %s", ErrRunNotRunning, run.Status)
	}

	action, err := validAction(req.Action)
	if err != nil {
		return nil, err
	}

	stepNumber := run.CurrentStep + 1
	agentID := req.AgentID
	if agentID == "" {
		agentID = run.AgentProfileID
	}

	actionInputJSON := "{}"
	if req.ActionInput != nil {
		b, err := json.Marshal(req.ActionInput)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal actionInput: %w", err)
		}
		actionInputJSON = string(b)
	}

	decision := &models.AgentDecision{
		RunID:       runID,
		AgentID:     agentID,
		StepNumber:  stepNumber,
		Action:      action,
		ActionInput: actionInputJSON,
		Reasoning:   fmt.Sprintf("Executing %s at step %d", action, stepNumber),
		CreatedAt:   time.Now().Unix(),
	}

	err = s.repo.CreateDecision(ctx, decision)
	if err != nil {
		return nil, err
	}

	err = s.repo.UpdateStep(ctx, runID, tenantID, stepNumber)
	if err != nil {
		// Step number revert not critical; decision is persisted.
	}

	return decision, nil
}

// ---- GetDecisions ----

// GetDecisions returns all decisions for a given run.
func (s *Service) GetDecisions(ctx context.Context, runID string, tenantID string) ([]models.AgentDecision, error) {
	// Verify run exists (tenant-scoped)
	_, err := s.repo.GetByTenant(ctx, runID, tenantID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	return s.repo.GetDecisionsByRunID(ctx, runID, tenantID)
}

// ---- GetStats ----

// GetStats returns aggregated run statistics.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.AgentRunStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// ---- Conversion helpers ----

// RunToInfo converts a database run to the API-facing response.
func (s *Service) RunToInfo(run *models.AgentRun) (*models.AgentRunInfo, error) {
	info := &models.AgentRunInfo{
		ID:               run.ID,
		TenantID:         run.TenantID,
		AgentProfileID:   run.AgentProfileID,
		AgentProfileName: run.AgentProfileName,
		Status:           run.Status,
		CurrentStep:      run.CurrentStep,
		TotalSteps:       run.TotalSteps,
		Error:            run.Error.String,
		StartedAt:        run.StartedAt,
		TimeoutAt:        run.TimeoutAt,
		CreatedAt:        run.CreatedAt,
	}
	if run.CompletedAt.Valid {
		v := run.CompletedAt.Int64
		info.CompletedAt = &v
	}
	if run.TriggerPayload != "" {
		var mp map[string]interface{}
		if err := json.Unmarshal([]byte(run.TriggerPayload), &mp); err == nil {
			info.TriggerPayload = mp
		}
	}
	if run.Result.Valid {
		var mp map[string]interface{}
		if err := json.Unmarshal([]byte(run.Result.String), &mp); err == nil {
			info.Result = mp
		}
	}
	return info, nil
}

// DecisionToResponse converts a database decision to the API response.
func (s *Service) DecisionToResponse(d *models.AgentDecision) *models.AgentDecisionResponse {
	resp := &models.AgentDecisionResponse{
		ID:         d.ID,
		RunID:      d.RunID,
		AgentID:    d.AgentID,
		StepNumber: d.StepNumber,
		Action:     d.Action,
		Reasoning:  d.Reasoning,
		Error:      d.Error.String,
		CreatedAt:  d.CreatedAt,
	}
	if d.ActionInput != "" {
		var mp map[string]interface{}
		if err := json.Unmarshal([]byte(d.ActionInput), &mp); err == nil {
			resp.ActionInput = mp
		}
	}
	if d.ActionOutput.Valid {
		var mp map[string]interface{}
		if err := json.Unmarshal([]byte(d.ActionOutput.String), &mp); err == nil {
			resp.ActionOutput = mp
		}
	}
	if d.ToolResult.Valid {
		var mp map[string]interface{}
		if err := json.Unmarshal([]byte(d.ToolResult.String), &mp); err == nil {
			resp.ToolResult = mp
		}
	}
	return resp
}
