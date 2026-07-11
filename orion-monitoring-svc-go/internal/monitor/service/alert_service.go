package service

import (
	"context"

	"github.com/google/uuid"
	"orion/monitoring-svc-go/internal/monitor/models"
	"orion/monitoring-svc-go/internal/monitor/repository"
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

func (s *AlertService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.alertRepo.Count(ctx, tenantID)
}

// EscalateAlert raises the severity of an alert.
func (s *AlertService) EscalateAlert(ctx context.Context, tenantID uuid.UUID, id uuid.UUID, escalatedBy, reason, toLevel string) (*models.Alert, error) {
	s.logger.Info("escalating alert", zap.String("alertId", id.String()), zap.String("toLevel", toLevel))
	return s.alertRepo.EscalateAlert(ctx, tenantID, id, toLevel)
}

// SuppressRule disables an alert rule.
func (s *AlertService) SuppressRule(ctx context.Context, tenantID uuid.UUID, id uuid.UUID, reason string) (*models.AlertRule, error) {
	s.logger.Info("suppressing alert rule", zap.String("ruleId", id.String()))
	return s.alertRepo.SuppressRule(ctx, tenantID, id, "system", reason)
}

// UnsuppressRule re-enables a suppressed rule.
func (s *AlertService) UnsuppressRule(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.AlertRule, error) {
	s.logger.Info("unsuppressing alert rule", zap.String("ruleId", id.String()))
	return s.alertRepo.UnsuppressRule(ctx, tenantID, id)
}

// EvaluateRule performs a manual rule evaluation.
func (s *AlertService) EvaluateRule(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.EvaluateRuleResult, error) {
	s.logger.Info("evaluating alert rule", zap.String("ruleId", id.String()))
	return s.alertRepo.EvaluateRule(ctx, tenantID, id)
}

// StartService marks a service as running.
func (s *AlertService) StartService(ctx context.Context, tenantID uuid.UUID, name string) (*models.ServiceInstance, error) {
	s.logger.Info("starting service", zap.String("serviceName", name))
	return s.alertRepo.StartService(ctx, tenantID, name)
}

// StopService marks a service as stopped.
func (s *AlertService) StopService(ctx context.Context, tenantID uuid.UUID, name string) (*models.ServiceInstance, error) {
	s.logger.Info("stopping service", zap.String("serviceName", name))
	return s.alertRepo.StopService(ctx, tenantID, name)
}

// GetServiceHealth returns the health status of a service.
func (s *AlertService) GetServiceHealth(ctx context.Context, tenantID uuid.UUID, name string) (*models.GetServiceHealthResult, error) {
	s.logger.Info("getting service health", zap.String("serviceName", name))
	return s.alertRepo.GetServiceHealth(ctx, tenantID, name)
}
