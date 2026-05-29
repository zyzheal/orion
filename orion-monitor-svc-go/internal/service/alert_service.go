package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/orion-platform/orion-monitor-svc-go/internal/models"
	"github.com/orion-platform/orion-monitor-svc-go/internal/repository"
	"go.uber.org/zap"
)

type AlertService struct {
	alertRepo *repository.AlertRepository
	logger    *zap.Logger
}

func NewAlertService(alertRepo *repository.AlertRepository, logger *zap.Logger) *AlertService {
	return &AlertService{alertRepo: alertRepo, logger: logger}
}

func (s *AlertService) QueryAlerts(ctx context.Context, tenantID uuid.UUID, req models.AlertQueryRequest) (models.AlertResponse, error) {
	return s.alertRepo.Query(ctx, tenantID, req)
}

func (s *AlertService) GetAlertByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Alert, error) {
	return s.alertRepo.GetByID(ctx, tenantID, id)
}

func (s *AlertService) SilenceAlert(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.alertRepo.SilenceAlert(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to silence alert",
			zap.String("alertId", id.String()),
			zap.String("tenantId", tenantID.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("alert silenced",
		zap.String("alertId", id.String()),
		zap.String("tenantId", tenantID.String()),
	)
	return nil
}

func (s *AlertService) ResolveAlert(ctx context.Context, tenantID, id uuid.UUID) error {
	if err := s.alertRepo.ResolveAlert(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to resolve alert",
			zap.String("alertId", id.String()),
			zap.String("tenantId", tenantID.String()),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("alert resolved",
		zap.String("alertId", id.String()),
		zap.String("tenantId", tenantID.String()),
	)
	return nil
}

func (s *AlertService) QueryAlertRules(ctx context.Context, tenantID uuid.UUID) (models.AlertRuleResponse, error) {
	return s.alertRepo.QueryAlertRules(ctx, tenantID)
}

func (s *AlertService) GetAlertRule(ctx context.Context, tenantID, id uuid.UUID) (*models.AlertRule, error) {
	return s.alertRepo.GetAlertRule(ctx, tenantID, id)
}

func (s *AlertService) CreateAlertRule(ctx context.Context, tenantID uuid.UUID, req models.CreateAlertRuleRequest) (*models.AlertRule, error) {
	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}

	rule := &models.AlertRule{
		ID:                    uuid.New(),
		TenantID:              tenantID,
		Name:                  req.Name,
		MetricName:            req.MetricName,
		Operator:              req.Operator,
		Threshold:             req.Threshold,
		EvaluationIntervalSec: req.EvaluationIntervalSec,
		IsEnabled:             isEnabled,
	}

	if err := s.alertRepo.CreateAlertRule(ctx, rule); err != nil {
		s.logger.Error("failed to create alert rule",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("alert rule created",
		zap.String("ruleId", rule.ID.String()),
		zap.String("name", req.Name),
		zap.String("tenantId", tenantID.String()),
	)
	return rule, nil
}

func (s *AlertService) UpdateAlertRule(ctx context.Context, tenantID, id uuid.UUID, req models.UpdateAlertRuleRequest) error {
	return s.alertRepo.UpdateAlertRule(ctx, tenantID, id, req)
}

func (s *AlertService) DeleteAlertRule(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.alertRepo.DeleteAlertRule(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
