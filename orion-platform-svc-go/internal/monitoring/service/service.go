package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
	"orion/platform-svc-go/internal/monitoring/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Service Control ---

func (s *Service) StartService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	// TODO: implement actual start.
	return &models.ServiceHealth{
		Status:  "started",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service started",
	}, nil
}

func (s *Service) StopService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	// TODO: implement actual stop.
	return &models.ServiceHealth{
		Status:  "stopped",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service stopped",
	}, nil
}

func (s *Service) HealthCheck(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	// TODO: implement health check.
	return &models.ServiceHealth{
		Status:  "healthy",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service is healthy",
	}, nil
}

// --- Metrics ---

func (s *Service) CreateMetric(ctx context.Context, tenantID string, req models.CreateMetricRequest) (*models.Metric, error) {
	m := &models.Metric{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Unit:     req.Unit,
		Labels:   req.Labels,
		Help:     req.Help,
		Enabled:  true,
	}
	if err := s.repo.CreateMetric(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) RecordMetric(ctx context.Context, tenantID string, req models.RecordMetricRequest) error {
	return s.repo.RecordMetric(ctx, tenantID, req)
}

func (s *Service) GetRegisteredMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error) {
	return s.repo.ListMetrics(ctx, tenantID, limit, offset)
}

func (s *Service) GetMetricSeries(ctx context.Context, tenantID, name string, since *time.Time, until *time.Time, limit int) (*models.MetricSeries, error) {
	points, err := s.repo.GetMetricSeries(ctx, tenantID, name, since, until, limit)
	if err != nil {
		return nil, err
	}
	return &models.MetricSeries{Name: name, Points: points}, nil
}

func (s *Service) GetMetricSummary(ctx context.Context, tenantID, name string, since *time.Time, until *time.Time) (*models.MetricSummary, error) {
	return s.repo.GetMetricSummary(ctx, tenantID, name, since, until)
}

// --- Alert Rules ---

func (s *Service) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) (*models.AlertRule, error) {
	rule := &models.AlertRule{
		TenantID: tenantID,
		Name:     req.Name,
		Metric:   req.Metric,
		Operator: req.Operator,
		Threshold: req.Threshold,
		EvaluationPeriod: req.EvaluationPeriod,
		Severity: req.Severity,
		Channels: req.Channels,
		Enabled:  true,
		Active:   true,
	}
	if rule.Operator == "" {
		rule.Operator = "gt"
	}
	if rule.Severity == "" {
		rule.Severity = "warning"
	}
	if err := s.repo.CreateRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) GetRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error) {
	return s.repo.ListRules(ctx, tenantID, limit, offset)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req models.UpdateRuleRequest) (*models.AlertRule, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Metric != nil {
		updates["metric"] = *req.Metric
	}
	if req.Operator != nil {
		updates["operator"] = *req.Operator
	}
	if req.Threshold != nil {
		updates["threshold"] = *req.Threshold
	}
	if req.EvaluationPeriod != nil {
		updates["evaluation_period"] = *req.EvaluationPeriod
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Channels != nil {
		updates["channels"] = *req.Channels
	}
	if err := s.repo.UpdateRule(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRule(ctx, tenantID, id)
}

func (s *Service) ToggleRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error) {
	if err := s.repo.ToggleRule(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) SuppressRule(ctx context.Context, tenantID, id string, req models.SuppressRuleRequest) (*models.AlertRule, error) {
	if err := s.repo.SuppressRule(ctx, tenantID, id, req.Reason, req.DurationH); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) UnsuppressRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	if err := s.repo.UnsuppressRule(ctx, tenantID, id); err != nil {
		return nil, err
	}
	return s.repo.GetRule(ctx, tenantID, id)
}

func (s *Service) EvaluateRules(ctx context.Context, tenantID string, ruleIDs []string) ([]map[string]interface{}, error) {
	// TODO: implement rule evaluation engine.
	return []map[string]interface{}{
		{"status": "ok", "message": "evaluation complete", "fired": 0},
	}, nil
}

// --- Alerts ---

func (s *Service) GetAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	return s.repo.ListAlerts(ctx, tenantID, limit, offset)
}

func (s *Service) GetActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	return s.repo.ListActiveAlerts(ctx, tenantID, limit, offset)
}

func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	return s.repo.GetAlert(ctx, tenantID, id)
}

func (s *Service) AcknowledgeAlert(ctx context.Context, tenantID, id, ackBy string, comment string) (*models.Alert, error) {
	if err := s.repo.AcknowledgeAlert(ctx, tenantID, id, ackBy, comment); err != nil {
		return nil, err
	}
	return s.repo.GetAlert(ctx, tenantID, id)
}

func (s *Service) ResolveAlert(ctx context.Context, tenantID, id string, comment string) (*models.Alert, error) {
	if err := s.repo.ResolveAlert(ctx, tenantID, id, comment); err != nil {
		return nil, err
	}
	return s.repo.GetAlert(ctx, tenantID, id)
}

func (s *Service) EscalateAlert(ctx context.Context, tenantID, id string, comment string) (*models.Alert, error) {
	// TODO: implement escalation logic.
	return s.AcknowledgeAlert(ctx, tenantID, id, "escalated", comment)
}

// --- Notification Channels ---

func (s *Service) CreateChannel(ctx context.Context, tenantID string, req models.CreateChannelRequest) (*models.NotificationChannel, error) {
	ch := &models.NotificationChannel{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Config:   req.Config,
		Enabled:  true,
	}
	if err := s.repo.CreateChannel(ctx, ch); err != nil {
		return nil, err
	}
	return ch, nil
}

func (s *Service) GetChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error) {
	return s.repo.ListChannels(ctx, tenantID, limit, offset)
}

func (s *Service) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) (*models.NotificationChannel, error) {
	if err := s.repo.ToggleChannel(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	return s.repo.GetChannel(ctx, tenantID, id)
}

// --- Escalation Policies ---

func (s *Service) CreateEscalationPolicy(ctx context.Context, tenantID string, req models.CreateEscalationPolicyRequest) (*models.EscalationPolicy, error) {
	ep := &models.EscalationPolicy{
		TenantID: tenantID,
		Name:     req.Name,
		Levels:   req.Levels,
	}
	if err := s.repo.CreateEscalationPolicy(ctx, ep); err != nil {
		return nil, err
	}
	return ep, nil
}

func (s *Service) GetEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error) {
	return s.repo.ListEscalationPolicies(ctx, tenantID, limit, offset)
}

// --- Notification History ---

func (s *Service) GetNotificationHistory(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error) {
	return s.repo.ListNotificationRecords(ctx, tenantID, limit, offset)
}

// --- Dashboard ---

func (s *Service) GetDashboard(ctx context.Context, tenantID string) (*models.DashboardSummary, error) {
	// TODO: implement dashboard aggregation.
	return &models.DashboardSummary{
		TotalRules:    0,
		ActiveAlerts:  0,
		TotalChannels: 0,
		TotalWidgets:  0,
	}, nil
}

func (s *Service) AddWidgetConfig(ctx context.Context, tenantID string, req models.AddWidgetConfigRequest) (*models.WidgetConfig, error) {
	w := &models.WidgetConfig{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Metric:   req.Metric,
		Config:   req.Config,
		Position: req.Position,
		Enabled:  true,
	}
	if err := s.repo.CreateWidgetConfig(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) GetWidgetConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.WidgetConfig, error) {
	return s.repo.ListWidgetConfigs(ctx, tenantID, limit, offset)
}

func (s *Service) GetAggregatedMetrics(ctx context.Context, tenantID string) (*models.AggregatedMetrics, error) {
	// TODO: implement aggregated metrics.
	return &models.AggregatedMetrics{
		BySeverity: map[string]models.SeverityCounts{},
	}, nil
}

// --- Anomalies ---

func (s *Service) DetectAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error) {
	// TODO: implement anomaly detection.
	return s.repo.ListAnomalies(ctx, tenantID, limit, offset)
}

func (s *Service) GetAnomalySummary(ctx context.Context, tenantID string) (*models.AnomalySummary, error) {
	// TODO: implement anomaly summary.
	return &models.AnomalySummary{
		BySeverity: map[string]int{},
	}, nil
}

// --- System Collect ---

func (s *Service) CollectSystemMetrics(ctx context.Context, tenantID string, req models.CollectSystemMetricsRequest) (*models.SystemMetrics, error) {
	// TODO: implement system metrics collection.
	sm := &models.SystemMetrics{
		Timestamp: time.Now().UTC(),
		Host:      req.Host,
	}
	return sm, nil
}

// --- Errors ---

var (
	ErrNotFound = errors.New("not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func ErrNotFoundResource(name string) error {
	return fmt.Errorf("%s not found: %w", name, ErrNotFound)
}
