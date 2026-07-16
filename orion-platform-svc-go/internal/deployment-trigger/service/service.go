package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"orion/platform-svc-go/internal/deployment-trigger/models"
	"orion/platform-svc-go/internal/deployment-trigger/repository"
)

var (
	ErrNotFound         = errors.New("deployment trigger not found")
	ErrDisabled         = errors.New("deployment trigger is disabled")
	ErrInvalidCron      = errors.New("invalid cron expression")
	ErrInvalidTagPattern  = errors.New("invalid tag pattern")
	ErrInvalidBranchPattern = errors.New("invalid branch pattern")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
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
	if err != nil && err == repository.ErrNotFound {
		return nil, ErrNotFound
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
		return ErrNotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// Execute records an execution attempt for a trigger.
func (s *Service) Execute(ctx context.Context, tenantID, id string) (*models.TriggerExecution, error) {
	trg, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil && err == repository.ErrNotFound {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if !trg.Enabled {
		return nil, ErrDisabled
	}

	ex := &models.TriggerExecution{
		TriggerID:   trg.ID,
		TenantID:    tenantID,
		TriggeredAt: time.Now().UTC(),
		Status:      models.ExecutionStatusRunning,
	}
	if err := s.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}

	// update last triggered reference on trigger
	_, err = s.repo.Update(ctx, tenantID, id, &models.UpdateTriggerRequest{
		Status: ptr(models.TriggerStatusTriggered),
	})
	_ = err // best-effort status update

	// mark execution as succeeded (simulated fire)
	_ = s.repo.CreateExecution(ctx, &models.TriggerExecution{
		TriggerID:   trg.ID,
		TenantID:    tenantID,
		TriggeredAt: time.Now().UTC(),
		Status:      models.ExecutionStatusSuccess,
	})

	return s.repo.GetLatestExecution(ctx, id, tenantID)
}

// GetExecutions returns execution history for a trigger.
func (s *Service) GetExecutions(ctx context.Context, tenantID, id string, limit int) ([]models.TriggerExecution, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
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
