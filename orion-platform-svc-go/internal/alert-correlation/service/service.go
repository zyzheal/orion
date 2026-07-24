package service

import (
	"context"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/alert-correlation/models"
	"orion/platform-svc-go/internal/alert-correlation/repository"
	"go.uber.org/zap"
)

type AlertCorrelationService struct {
	repo   *repository.AlertCorrelationRepository
	logger *zap.Logger
}

func NewAlertCorrelationService(repo *repository.AlertCorrelationRepository, logger *zap.Logger) *AlertCorrelationService {
	return &AlertCorrelationService{repo: repo, logger: logger}
}

// CreateGroup creates a correlation group.
func (s *AlertCorrelationService) CreateGroup(ctx context.Context, tenantID, rootAlertID uuid.UUID, alertIDs []uuid.UUID, groupType string) (*models.CorrelationGroup, error) {
	if len(alertIDs) < 1 {
		return nil, nil
	}

	group, err := s.repo.CreateGroup(ctx, tenantID, rootAlertID, alertIDs, groupType)
	if err != nil {
		s.logger.Error("failed to create correlation group",
			zap.String("rootAlertId", rootAlertID.String()),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("correlation group created",
		zap.String("groupId", group.ID.String()),
		zap.Int("alertCount", len(alertIDs)),
		zap.String("groupType", groupType),
	)
	return group, nil
}

// QueryGroups returns paginated correlation groups.
func (s *AlertCorrelationService) QueryGroups(ctx context.Context, tenantID uuid.UUID, groupType string, limit, offset int) (models.CorrelationResult, error) {
	return s.repo.QueryGroups(ctx, tenantID, groupType, limit, offset)
}

// GetGroup returns a correlation group by ID.
func (s *AlertCorrelationService) GetGroup(ctx context.Context, tenantID, id uuid.UUID) (*models.CorrelationGroup, error) {
	return s.repo.GetGroup(ctx, tenantID, id)
}

// DeleteGroup removes a correlation group.
func (s *AlertCorrelationService) DeleteGroup(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.repo.DeleteGroup(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete correlation group",
			zap.String("groupId", id.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("correlation group deleted", zap.String("groupId", id.String()))
	return nil
}

// CreateRule creates a correlation rule.
func (s *AlertCorrelationService) CreateRule(ctx context.Context, tenantID uuid.UUID, name, description, groupType string, timeWindowSec int, conditions string) (*models.CorrelationRule, error) {
	if timeWindowSec <= 0 {
		timeWindowSec = 300
	}
	rule, err := s.repo.CreateRule(ctx, tenantID, name, description, groupType, timeWindowSec, conditions)
	if err != nil {
		s.logger.Error("failed to create correlation rule",
			zap.String("name", name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("correlation rule created",
		zap.String("ruleId", rule.ID.String()),
		zap.String("name", rule.Name),
	)
	return rule, nil
}

// QueryRules returns paginated correlation rules.
func (s *AlertCorrelationService) QueryRules(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.CorrelationRule, int64, error) {
	return s.repo.QueryRules(ctx, tenantID, limit, offset)
}

// AutoCorrelate automatically groups alerts based on rules.
func (s *AlertCorrelationService) AutoCorrelate(ctx context.Context, tenantID uuid.UUID) ([]models.CorrelationGroup, error) {
	rules, _, err := s.repo.QueryRules(ctx, tenantID, 100, 0)
	if err != nil {
		return nil, err
	}

	var groups []models.CorrelationGroup
	for _, rule := range rules {
		if !rule.IsEnabled {
			continue
		}
		// Simplified: in a real implementation, this would query recent alerts
		// and group them based on the rule conditions
		s.logger.Debug("applying correlation rule",
			zap.String("ruleId", rule.ID.String()),
			zap.String("groupType", rule.GroupType),
		)
	}

	s.logger.Info("auto-correlation completed",
		zap.Int("groupsFound", len(groups)),
	)
	return groups, nil
}
