package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/selfhealing/models"
	"orion/monitor-svc-go/internal/selfhealing/repository"
	"go.uber.org/zap"
)

type SelfHealingService struct {
	repo   *repository.SelfHealingRepository
	logger *zap.Logger
}

func NewSelfHealingService(repo *repository.SelfHealingRepository, logger *zap.Logger) *SelfHealingService {
	return &SelfHealingService{repo: repo, logger: logger}
}

// CreateHealingAction creates a new healing action.
func (s *SelfHealingService) CreateHealingAction(ctx context.Context, tenantID uuid.UUID, req *models.CreateHealingActionRequest) (*models.HealingAction, error) {
	if req.RetryCount < 0 {
		req.RetryCount = 0
	}
	if req.RetryDelay < 0 {
		req.RetryDelay = 0
	}

	action, err := s.repo.CreateHealingAction(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create healing action",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("healing action created",
		zap.String("actionId", action.ID.String()),
		zap.String("name", action.Name),
		zap.String("actionType", action.ActionType),
	)
	return action, nil
}

// QueryHealingActions returns paginated healing actions.
func (s *SelfHealingService) QueryHealingActions(ctx context.Context, tenantID uuid.UUID, limit, offset int) (models.HealingActionResponse, error) {
	return s.repo.QueryHealingActions(ctx, tenantID, limit, offset)
}

// GetHealingAction returns a healing action by ID.
func (s *SelfHealingService) GetHealingAction(ctx context.Context, tenantID, id uuid.UUID) (*models.HealingAction, error) {
	return s.repo.GetHealingAction(ctx, tenantID, id)
}

// UpdateHealingAction updates a healing action.
func (s *SelfHealingService) UpdateHealingAction(ctx context.Context, tenantID, id uuid.UUID, name, description, command *string, isEnabled *bool) (*models.HealingAction, error) {
	action, err := s.repo.UpdateHealingAction(ctx, tenantID, id, name, description, command, isEnabled)
	if err != nil {
		s.logger.Error("failed to update healing action",
			zap.String("actionId", id.String()),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("healing action updated", zap.String("actionId", id.String()))
	return action, nil
}

// DeleteHealingAction removes a healing action.
func (s *SelfHealingService) DeleteHealingAction(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.repo.DeleteHealingAction(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete healing action",
			zap.String("actionId", id.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("healing action deleted", zap.String("actionId", id.String()))
	return nil
}

// ExecuteAction executes a healing action with retry logic.
func (s *SelfHealingService) ExecuteAction(ctx context.Context, tenantID, actionID uuid.UUID, triggeredBy string) (*models.HealingHistory, error) {
	action, err := s.repo.GetHealingAction(ctx, tenantID, actionID)
	if err != nil {
		return nil, fmt.Errorf("healing action not found: %s", actionID)
	}

	if !action.IsEnabled {
		return nil, fmt.Errorf("healing action is disabled: %s", action.ID)
	}

	history, err := s.repo.ExecuteHealingAction(ctx, tenantID, actionID, nil, triggeredBy)
	if err != nil {
		return nil, err
	}

	maxAttempts := action.RetryCount + 1
	if maxAttempts <= 0 {
		maxAttempts = 1
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := s.executeSingleAttempt(action, triggeredBy); err != nil {
			s.logger.Warn("healing action attempt failed",
				zap.String("actionId", action.ID.String()),
				zap.Int("attempt", attempt),
				zap.Error(err),
			)
			_ = s.repo.UpdateHealingHistory(ctx, history.ID, "failed", err.Error(), attempt)
			continue
		}

		_ = s.repo.UpdateHealingHistory(ctx, history.ID, "completed", "Action executed successfully", attempt)
		s.logger.Info("healing action completed",
			zap.String("actionId", action.ID.String()),
			zap.Int("attempt", attempt),
		)
		return history, nil
	}

	s.logger.Error("healing action exhausted all retries",
		zap.String("actionId", action.ID.String()),
		zap.Int("maxAttempts", maxAttempts),
	)
	return history, nil
}

func (s *SelfHealingService) executeSingleAttempt(action *models.HealingAction, triggeredBy string) error {
	switch strings.ToLower(action.ActionType) {
	case "restart":
		s.logger.Info("executing restart action",
			zap.String("target", action.Target),
			zap.String("triggeredBy", triggeredBy),
		)
	case "deploy":
		s.logger.Info("executing deploy action",
			zap.String("target", action.Target),
			zap.String("triggeredBy", triggeredBy),
		)
	case "rollback":
		s.logger.Info("executing rollback action",
			zap.String("target", action.Target),
			zap.String("triggeredBy", triggeredBy),
		)
	case "scale":
		s.logger.Info("executing scale action",
			zap.String("target", action.Target),
			zap.String("triggeredBy", triggeredBy),
		)
	case "notify":
		s.logger.Info("executing notify action",
			zap.String("target", action.Target),
			zap.String("triggeredBy", triggeredBy),
		)
	case "run_script":
		if action.Command == "" {
			return fmt.Errorf("command is required for run_script action type")
		}
		s.logger.Info("executing run_script action",
			zap.String("target", action.Target),
			zap.String("command", action.Command),
			zap.String("triggeredBy", triggeredBy),
		)
	default:
		return fmt.Errorf("unknown action type: %s", action.ActionType)
	}
	return nil
}

// QueryHealingHistory returns paginated healing history.
func (s *SelfHealingService) QueryHealingHistory(ctx context.Context, tenantID, actionID uuid.UUID, status string, limit, offset int) (models.HealingHistoryResponse, error) {
	return s.repo.QueryHealingHistory(ctx, tenantID, actionID, status, limit, offset)
}
