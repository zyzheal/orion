package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/deployment-trigger/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.DeploymentTrigger, error)
	CreateExecution(ctx context.Context, ex *models.TriggerExecution) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DeploymentTrigger, error)
	GetExecutions(ctx context.Context, triggerID, tenantID string, limit int) ([]models.TriggerExecution, error)
	GetLatestExecution(ctx context.Context, triggerID, tenantID string) (*models.TriggerExecution, error)
	List(ctx context.Context, tenantID string) ([]models.DeploymentTrigger, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.DeploymentTrigger, error)
}

var (
	ErrDisabled             = errors.New("deployment trigger is disabled")
	ErrInvalidCron          = errors.New("invalid cron expression")
	ErrInvalidTagPattern    = errors.New("invalid tag pattern")
	ErrInvalidBranchPattern = errors.New("invalid branch pattern")
)

// PipelineRunner is the interface used to trigger a pipeline run.
// Implemented by pipeline.Service (StartRun).
type PipelineRunner interface {
	StartRun(ctx context.Context, tenantID, pipelineID string) (runID string, status string, err error)
}

type Service struct {
	repo    RepositoryInterface
	pipeline PipelineRunner
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// WithPipelineRunner wires an optional pipeline runner into the service.
// When set, Execute() will actually trigger the target pipeline instead of
// just recording a simulated success.
func (s *Service) WithPipelineRunner(runner PipelineRunner) {
	s.pipeline = runner
}

// Create validates and creates a trigger.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.DeploymentTrigger, error) {
	if err := validateExpression(req.TriggerType, req.Expression); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, tenantID, req)
}

// Get retrieves a trigger by id.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.DeploymentTrigger, error) {
	trg, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil && err == sentinel.NotFound {
		return nil, sentinel.NotFound
	}
	return trg, err
}

// List returns all triggers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]models.DeploymentTrigger, error) {
	return s.repo.List(ctx, tenantID)
}

// Update patches trigger fields.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.DeploymentTrigger, error) {
	// validate expression if trigger type changed
	if req.TriggerType != nil && req.Expression != nil {
		if err := validateExpression(*req.TriggerType, *req.Expression); err != nil {
			return nil, err
		}
	}
	return s.repo.Update(ctx, tenantID, id, req)
}

// Delete removes a trigger.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sentinel.NotFound {
			return sentinel.NotFound
		}
		return err
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// Execute triggers the target pipeline for a trigger and records the execution.
//
// When a PipelineRunner is wired and the trigger has a target pipeline, it
// delegates to the runner to start a real pipeline run. The returned
// TriggerExecution reflects the actual runner outcome (success/failure) so
// callers can distinguish a genuine pipeline launch from a missing integration.
//
// When no runner is configured the execution is recorded as failed with a
// descriptive error so the missing integration is visible rather than silently
// simulated.
func (s *Service) Execute(ctx context.Context, tenantID, id string) (*models.TriggerExecution, error) {
	trg, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sentinel.NotFound {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	if !trg.Enabled {
		return nil, ErrDisabled
	}

	// best-effort status update on trigger (do not fail the trigger)
	now := time.Now().UTC()
	_ = s.repo.Update(ctx, tenantID, id, &models.UpdateTriggerRequest{
		Status: ptr(models.TriggerStatusTriggered),
	})

	// No pipeline runner or no target — record failure so the gap is visible.
	if s.pipeline == nil || trg.TargetPipeline == "" {
		reason := "no pipeline runner configured"
		if s.pipeline == nil {
			reason = "no pipeline runner configured"
		}
		if trg.TargetPipeline == "" {
			reason = "trigger has no target pipeline configured"
		}
		ex := &models.TriggerExecution{
			TriggerID:   trg.ID,
			TenantID:    tenantID,
			TriggeredAt: now,
			Status:      models.ExecutionStatusFailed,
			Error:       reason,
		}
		if err := s.repo.CreateExecution(ctx, ex); err != nil {
			return nil, err
		}
		return ex, nil
	}

	// Trigger the target pipeline.
	pipelineRunID, _, runErr := s.pipeline.StartRun(ctx, tenantID, trg.TargetPipeline)
	if runErr != nil {
		ex := &models.TriggerExecution{
			TriggerID:     trg.ID,
			TenantID:      tenantID,
			TriggeredAt:   now,
			Status:        models.ExecutionStatusFailed,
			PipelineRunID: pipelineRunID,
			Error:         runErr.Error(),
		}
		if err := s.repo.CreateExecution(ctx, ex); err != nil {
			return nil, err
		}
		return ex, nil
	}

	// Pipeline started successfully.
	ex := &models.TriggerExecution{
		TriggerID:     trg.ID,
		TenantID:      tenantID,
		TriggeredAt:   now,
		Status:        models.ExecutionStatusSuccess,
		PipelineRunID: pipelineRunID,
	}
	if err := s.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}
	return ex, nil
}

// GetExecutions returns execution history for a trigger.
func (s *Service) GetExecutions(ctx context.Context, tenantID, id string, limit int) ([]models.TriggerExecution, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return s.repo.GetExecutions(ctx, id, tenantID, limit)
}

// EvaluateCron returns the next fire time for a cron expression.
func (s *Service) EvaluateCron(expression string) (*time.Time, error) {
	if expression == "" {
		return nil, ErrInvalidCron
	}
	// validate cron has 5+ fields
	fields := splitNonEmpty(expression)
	if len(fields) < 5 {
		return nil, ErrInvalidCron
	}
	next, err := nextFireTime(expression)
	if err != nil {
		return nil, err
	}
	return next, nil
}

// validateExpression checks the expression for the given trigger type.
func validateExpression(t models.TriggerType, expr string) error {
	switch t {
	case models.TriggerTypeCron, models.TriggerTypeScheduled:
		if expr == "" {
			return ErrInvalidCron
		}
		err := sValidateCron(expr)
		return err
	case models.TriggerTypeTagPush:
		if expr != "" {
			return validatePattern(expr, ErrInvalidTagPattern)
		}
		return nil
	case models.TriggerTypeBranchPush:
		if expr != "" {
			return validatePattern(expr, ErrInvalidBranchPattern)
		}
		return nil
	case models.TriggerTypeManual, models.TriggerTypeAPI:
		return nil
	default:
		return nil
	}
}

// sValidateCron validates a 5-field cron expression.
func sValidateCron(expr string) error {
	for _, f := range splitNonEmpty(expr) {
		if f == "*" || f == "?" {
			continue
		}
		// allow digit, */N, N-M, N/M combos
		if !regexp.MustCompile(`^[\d\*,/\-]+$`).MatchString(f) {
			return ErrInvalidCron
		}
	}
	fields := splitNonEmpty(expr)
	if len(fields) != 5 && len(fields) != 6 {
		return ErrInvalidCron
	}
	return nil
}

func validatePattern(pat string, err error) error {
	// must be a non-empty glob pattern
	if pat == "" {
		return nil
	}
	if regexp.MustCompile(`[^a-zA-Z0-9_\-/*\?\.]`).MatchString(pat) {
		return err
	}
	return nil
}

// nextFireTime gives an approximate next execution by advancing 1 minute
// from now, ignoring actual cron scheduling (no external cron library).
func nextFireTime(expr string) (*time.Time, error) {
	if sValidateCron(expr) != nil {
		return nil, ErrInvalidCron
	}
	// approximate next fire = now rounded up to next minute + 1
	next := time.Now().UTC().Add(1 * time.Minute).Truncate(time.Minute)
	return &next, nil
}

func splitNonEmpty(s string) []string {
	var out []string
	for _, p := range splitBySpace(s) {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func splitBySpace(s string) []string {
	// simple manual split on whitespace
	var parts []string
	var buf string
	for _, c := range s {
		if c == ' ' || c == '\t' {
			if buf != "" {
				parts = append(parts, buf)
				buf = ""
			}
		} else {
			buf += string(c)
		}
	}
	if buf != "" {
		parts = append(parts, buf)
	}
	return parts
}

func ptr(v models.TriggerStatus) *models.TriggerStatus {
	return &v
}

// unused marker to keep fmt imported
var _ = fmt.Sprintf
