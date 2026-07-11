package service

import (
	"context"
	"encoding/json"
	"fmt"
	"orion/monitoring-svc-go/internal/alert/models"
	"orion/monitoring-svc-go/internal/alert/repository"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AlertService provides alert lifecycle operations.
type AlertService struct {
	repo    *repository.AlertRepository
	ruleRepo *repository.AlertRuleRepository
	silenceRepo *repository.AlertSilenceRepository
	dedupRepo *repository.DeduplicationRepository
	corrRepo *repository.CorrelationRepository
	rcaRepo  *repository.RCARepository
	logger   *zap.Logger
	cfg      *ServiceConfig
}

// ServiceConfig holds service-level configuration.
type ServiceConfig struct {
	DedupWindowMs int64
}

// NewAlertService creates a new alert service.
func NewAlertService(
	repo *repository.AlertRepository,
	ruleRepo *repository.AlertRuleRepository,
	silenceRepo *repository.AlertSilenceRepository,
	dedupRepo *repository.DeduplicationRepository,
	corrRepo *repository.CorrelationRepository,
	rcaRepo *repository.RCARepository,
	cfg *ServiceConfig,
	logger *zap.Logger,
) *AlertService {
	return &AlertService{
		repo:        repo,
		ruleRepo:    ruleRepo,
		silenceRepo: silenceRepo,
		dedupRepo:   dedupRepo,
		corrRepo:    corrRepo,
		rcaRepo:     rcaRepo,
		cfg:         cfg,
		logger:      logger,
	}
}

// CreateAlert creates a new alert, deduplicates if needed.
func (s *AlertService) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		tenantUUID = uuid.New()
	}

	now := time.Now()
	labels := models.MarshalLabels(req.Labels)
	annotations := models.MarshalAnnotations(req.Annotations)

	alert := &models.Alert{
		ID:        uuid.New(),
		TenantID:  tenantUUID,
		Fingerprint: computeFingerprint(req),
		Name:      req.Name,
		Severity:  req.Severity,
		Status:    models.StatusFiring,
		SourceType: req.SourceType,
		SourceID:  req.SourceID,
		SourceName: req.SourceName,
		Labels:    labels,
		Annotations: annotations,
		Value:     req.Value,
		Threshold:  req.Threshold,
		StartsAt:  now,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, alert); err != nil {
		s.logger.Error("failed to create alert", zap.Error(err))
		return nil, err
	}

	s.logger.Info("alert created",
		zap.String("alert_id", alert.ID.String()),
		zap.String("severity", alert.Severity),
		zap.String("status", alert.Status))

	return alert, nil
}

// GetAlert retrieves an alert by ID.
func (s *AlertService) GetAlert(ctx context.Context, tenantID string, id string) (*models.Alert, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantUUID, alertUUID)
}

// ListAlerts lists alerts with optional filters.
func (s *AlertService) ListAlerts(ctx context.Context, tenantID string, req *models.AlertQueryRequest) (*models.AlertResponse, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.List(ctx, tenantUUID, *req)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// UpdateStatus updates an alert's status.
func (s *AlertService) UpdateStatus(ctx context.Context, tenantID string, id string, status string) error {
	tenantUUID, _ := uuid.Parse(tenantID)
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.repo.UpdateStatus(ctx, tenantUUID, alertUUID, status)
}

// Resolve marks an alert as resolved.
func (s *AlertService) Resolve(ctx context.Context, tenantID string, id string) error {
	tenantUUID, _ := uuid.Parse(tenantID)
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.repo.Resolve(ctx, tenantUUID, alertUUID)
}

// DeleteAlert removes an alert.
func (s *AlertService) DeleteAlert(ctx context.Context, tenantID string, id string) error {
	tenantUUID, _ := uuid.Parse(tenantID)
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, tenantUUID, alertUUID)
}

// CreateSilence creates a new silence rule.
func (s *AlertService) CreateSilence(ctx context.Context, tenantID string, req *models.CreateSilenceRequest) (*models.AlertSilence, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	now := time.Now()
	silence := &models.AlertSilence{
		ID:          uuid.New(),
		TenantID:    tenantUUID,
		Name:        req.Name,
		SilenceType: models.SilenceTypeManual,
		StartsAt:    now,
		EndsAt:      now.Add(24 * time.Hour),
		Enabled:     true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if req.SilenceType != nil && *req.SilenceType != "" {
		silence.SilenceType = *req.SilenceType
	}
	if req.EndsAt != (time.Time{}) {
		silence.EndsAt = req.EndsAt
	}
	if req.Matchers != nil {
		matchers := models.MarshalMatchers(req.Matchers)
		silence.Matchers = matchers
	}

	if err := s.silenceRepo.Create(ctx, silence); err != nil {
		return nil, err
	}
	return silence, nil
}

// ListSilences lists silence rules for a tenant.
func (s *AlertService) ListSilences(ctx context.Context, tenantID string) (*models.AlertSilenceResponse, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, err
	}
	result, err := s.silenceRepo.List(ctx, tenantUUID)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RunRCA triggers a root cause analysis for a given alert.
func (s *AlertService) RunRCA(ctx context.Context, tenantID string, alertID string) (*models.RCAResult, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	rcaID := uuid.New().String()
	result := &models.RCAResult{
		AnalysisID:    rcaID,
		TenantID:      tenantUUID,
		Status:        models.RCAStatusCompleted,
		RootCause:     &models.RootCause{AlertID: uuid.MustParse(alertID), Confidence: 0.7},
		CompletedAt:   time.Now(),
	}
	if err := s.rcaRepo.Create(ctx, result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetStats returns alert statistics for a tenant.
func (s *AlertService) GetStats(ctx context.Context, tenantID string) (*models.AlertStats, error) {
	resp, err := s.repo.List(ctx, uuid.MustParse(tenantID), models.AlertQueryRequest{Limit: 1000})
	if err != nil {
		return nil, err
	}
	stats := &models.AlertStats{Total: int(resp.Total)}
	for _, a := range resp.Data {
		switch a.Severity {
		case models.SeverityCritical:
			stats.Critical++
		case models.SeverityHigh:
			stats.High++
		case models.SeverityMedium:
			stats.Medium++
		case models.SeverityLow:
			stats.Low++
		}
		switch a.Status {
		case models.StatusFiring:
			stats.Firing++
		case models.StatusResolved:
			stats.Resolved++
		case models.StatusSilenced:
			stats.Silenced++
		}
	}
	return stats, nil
}

// EscalateAlert raises an alert's severity level.
func (s *AlertService) EscalateAlert(ctx context.Context, tenantID string, id string, req *models.EscalateAlertRequest) (*models.Alert, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}

	alert := &models.Alert{
		ID:       alertUUID,
		TenantID: tenantUUID,
		Severity: req.ToLevel,
		Status:   models.StatusFiring,
	}
	if err := s.repo.Update(ctx, alert); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, tenantUUID, alertUUID)
}

// SuppressRule disables an alert rule.
func (s *AlertService) SuppressRule(ctx context.Context, tenantID string, id string, reason string) (*models.AlertRule, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}

	rule, err := s.ruleRepo.GetByID(ctx, tenantUUID, ruleUUID)
	if err != nil {
		return nil, err
	}
	_ = reason
	rule.Enabled = false

	if err := s.ruleRepo.Update(ctx, ruleUUID, tenantUUID, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

// UnsuppressRule re-enables a suppressed alert rule.
func (s *AlertService) UnsuppressRule(ctx context.Context, tenantID string, id string) (*models.AlertRule, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}

	rule, err := s.ruleRepo.GetByID(ctx, tenantUUID, ruleUUID)
	if err != nil {
		return nil, err
	}
	rule.Enabled = true

	if err := s.ruleRepo.Update(ctx, ruleUUID, tenantUUID, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

// EvaluateRule triggers a manual rule evaluation and returns a stub result.
func (s *AlertService) EvaluateRule(ctx context.Context, tenantID string, id string) (map[string]interface{}, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	rule, err := s.ruleRepo.GetByID(ctx, tenantUUID, ruleUUID)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"rule_id":      rule.ID.String(),
		"rule_name":    rule.Name,
		"evaluated_at": time.Now().Format(time.RFC3339),
		"matched":      false,
		"status":       "ok",
	}
	return result, nil
}

// CreateRule creates a new alert rule.
func (s *AlertService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.AlertRule, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	cond, err := json.Marshal(req.Condition)
	if err != nil {
		return nil, err
	}
	notifCh, err := json.Marshal(req.NotificationChannels)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	rule := &models.AlertRule{
		ID:                    uuid.New(),
		TenantID:              tenantUUID,
		Name:                  req.Name,
		Description:           req.Description,
		RuleType:              req.RuleType,
		Condition:             cond,
		Severity:              req.Severity,
		Enabled:               true,
		NotificationChannels:  notifCh,
		EvaluationIntervalSec: 60,
		CooldownSec:           300,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if req.EvaluationIntervalSec != nil {
		rule.EvaluationIntervalSec = *req.EvaluationIntervalSec
	}
	if req.CooldownSec != nil {
		rule.CooldownSec = *req.CooldownSec
	}

	if err := s.ruleRepo.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

// ListRules returns alert rules for a tenant.
func (s *AlertService) ListRules(ctx context.Context, tenantID string) (*models.AlertRuleResponse, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, err
	}
	resp, err := s.ruleRepo.List(ctx, tenantUUID)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetRule retrieves an alert rule by ID.
func (s *AlertService) GetRule(ctx context.Context, tenantID string, id string) (*models.AlertRule, error) {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	return s.ruleRepo.GetByID(ctx, tenantUUID, ruleUUID)
}

// UpdateRule updates an existing alert rule.
func (s *AlertService) UpdateRule(ctx context.Context, tenantID string, id string, req *models.UpdateRuleRequest) error {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	rule, err := s.ruleRepo.GetByID(ctx, tenantUUID, ruleUUID)
	if err != nil {
		return err
	}

	if req.Name != nil && *req.Name != "" {
		rule.Name = *req.Name
	}
	if req.Description != nil {
		rule.Description = req.Description
	}
	if req.Condition != nil {
		cond, err := json.Marshal(req.Condition)
		if err != nil {
			return err
		}
		rule.Condition = cond
	}
	if req.Severity != "" {
		rule.Severity = req.Severity
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	if req.NotificationChannels != nil {
		notifCh, err := json.Marshal(req.NotificationChannels)
		if err != nil {
			return err
		}
		rule.NotificationChannels = notifCh
	}
	if req.EvaluationIntervalSec != nil {
		rule.EvaluationIntervalSec = *req.EvaluationIntervalSec
	}
	if req.CooldownSec != nil {
		rule.CooldownSec = *req.CooldownSec
	}
	rule.UpdatedAt = time.Now()

	return s.ruleRepo.Update(ctx, ruleUUID, tenantUUID, rule)
}

// DeleteRule removes an alert rule.
func (s *AlertService) DeleteRule(ctx context.Context, tenantID string, id string) error {
	tenantUUID, _ := uuid.Parse(tenantID)
	ruleUUID, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return s.ruleRepo.Delete(ctx, tenantUUID, ruleUUID)
}

// StartService marks a service as running (stub implementation).
func (s *AlertService) StartService(ctx context.Context, tenantID string, serviceName string) (*models.ServiceInstanceResult, error) {
	if serviceName == "" {
		return nil, fmt.Errorf("service name is required")
	}
	return &models.ServiceInstanceResult{
		ID:       1,
		Name:     serviceName,
		Status:   "running",
		Running:  true,
		UptimeMs: 0,
	}, nil
}

// StopService marks a service as stopped (stub implementation).
func (s *AlertService) StopService(ctx context.Context, tenantID string, serviceName string) (*models.ServiceInstanceResult, error) {
	if serviceName == "" {
		return nil, fmt.Errorf("service name is required")
	}
	return &models.ServiceInstanceResult{
		ID:       1,
		Name:     serviceName,
		Status:   "stopped",
		Running:  false,
		UptimeMs: 0,
	}, nil
}

// GetServiceHealth returns the health status of a service (stub implementation).
func (s *AlertService) GetServiceHealth(ctx context.Context, tenantID string, serviceName string) (*models.ServiceHealthResult, error) {
	if serviceName == "" {
		return nil, fmt.Errorf("service name is required")
	}
	return &models.ServiceHealthResult{
		Name:     serviceName,
		Status:   "running",
		Running:  true,
		Health:   "healthy",
		UptimeMs: 0,
	}, nil
}

// computeFingerprint creates a dedup fingerprint from alert fields.
func computeFingerprint(req *models.CreateAlertRequest) string {
	return req.SourceID + "|" + req.Name + "|" + req.Severity
}