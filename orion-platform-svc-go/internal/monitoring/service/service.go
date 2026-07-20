package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"runtime"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AcknowledgeAlert(ctx context.Context, tenantID, id, ackBy string, comment string) error
	CountAlertsBySeverity(ctx context.Context, tenantID string) ([]models.Alert, error)
	CountAnomaliesByMetric(ctx context.Context, tenantID string) ([]struct {
		Metric   string  `db:"metric"`
		Count    int     `db:"count"`
		AvgScore float64 `db:"avg_score"`
	}, error)
	CountAnomaliesBySeverity(ctx context.Context, tenantID string) ([]struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}, error)
	CountAnomaliesLast24h(ctx context.Context, tenantID string) (int, error)
	CreateAlert(ctx context.Context, alert *models.Alert) error
	CreateAnomaly(ctx context.Context, a *models.Anomaly) error
	CreateChannel(ctx context.Context, ch *models.NotificationChannel) error
	CreateEscalationPolicy(ctx context.Context, ep *models.EscalationPolicy) error
	CreateMetric(ctx context.Context, m *models.Metric) error
	CreateNotificationRecord(ctx context.Context, nr *models.NotificationRecord) error
	CreateRule(ctx context.Context, rule *models.AlertRule) error
	CreateWidgetConfig(ctx context.Context, w *models.WidgetConfig) error
	DeleteRule(ctx context.Context, tenantID, id string) error
	GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error)
	GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error)
	GetMetricSeries(ctx context.Context, tenantID, name string, since, until *time.Time, limit int) ([]models.MetricSeriesPoint, error)
	GetMetricSummary(ctx context.Context, tenantID, name string, since, until *time.Time) (*models.MetricSummary, error)
	GetRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error)
	GetServiceStatus(ctx context.Context, tenantID string) (string, error)
	ListActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error)
	ListAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error)
	ListAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error)
	ListChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error)
	ListEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error)
	ListMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error)
	ListNotificationRecords(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error)
	ListRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error)
	ListWidgetConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.WidgetConfig, error)
	PingContext(ctx context.Context) error
	RecordMetric(ctx context.Context, tenantID string, req models.RecordMetricRequest) error
	ResolveAlert(ctx context.Context, tenantID, id string, comment string) error
	RuleAlertCounts(ctx context.Context, tenantID string) ([]models.RuleAlertCounts, error)
	SetServiceStatus(ctx context.Context, tenantID, status string) error
	SuppressRule(ctx context.Context, tenantID, id string, reason string, durationH *int) error
	ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error
	ToggleRule(ctx context.Context, tenantID, id string, enabled bool) error
	UnsuppressRule(ctx context.Context, tenantID, id string) error
	UpdateAlertStatus(ctx context.Context, tenantID, id, severity, status string) error
	UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

// Service provides the monitoring business-logic layer.
// It delegates persistence to RepositoryInterface and implements the
// rule-evaluation, escalation, anomaly-detection, dashboard-aggregation and
// system-metrics-collecting engines.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Service Control ------------------------------------------------

func (s *Service) StartService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if err := s.repo.SetServiceStatus(ctx, tenantID, "running"); err != nil {
		return nil, fmt.Errorf("start service: %w", err)
	}
	return &models.ServiceHealth{
		Status:  "running",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service started",
	}, nil
}

func (s *Service) StopService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if err := s.repo.SetServiceStatus(ctx, tenantID, "stopped"); err != nil {
		return nil, fmt.Errorf("stop service: %w", err)
	}
	return &models.ServiceHealth{
		Status:  "stopped",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service stopped",
	}, nil
}

func (s *Service) HealthCheck(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	// 1. Verify database connectivity with a short timeout.
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	pingErr := s.repo.PingContext(pingCtx)

	// 2. Read service status from the persistence layer.
	status := "unknown"
	if tenantID != "" {
		if st, err := s.repo.GetServiceStatus(ctx, tenantID); err == nil {
			status = st
		}
	}

	healthy := pingErr == nil && status == "running"
	if pingErr != nil {
		return &models.ServiceHealth{
			Status:  "unhealthy",
			Uptime:  time.Now().UTC(),
			Message: fmt.Sprintf("monitoring service unhealthy: db ping failed: %s", pingErr.Error()),
		}, nil
	}
	if status == "stopped" {
		return &models.ServiceHealth{
			Status:  "stopped",
			Uptime:  time.Now().UTC(),
			Message: "monitoring service is stopped",
		}, nil
	}
	if !healthy {
		return &models.ServiceHealth{
			Status:  "degraded",
			Uptime:  time.Now().UTC(),
			Message: fmt.Sprintf("monitoring service degraded, status=%s", status),
		}, nil
	}
	return &models.ServiceHealth{
		Status:  "healthy",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service is healthy",
	}, nil
}

// --- Metrics --------------------------------------------------------

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

// --- Alert Rules ----------------------------------------------------

func (s *Service) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) (*models.AlertRule, error) {
	rule := &models.AlertRule{
		TenantID:         tenantID,
		Name:             req.Name,
		Metric:           req.Metric,
		Operator:         req.Operator,
		Threshold:        req.Threshold,
		EvaluationPeriod: req.EvaluationPeriod,
		Severity:         req.Severity,
		Channels:         req.Channels,
		Enabled:          true,
		Active:           true,
	}
	if rule.Operator == "" {
		rule.Operator = "gt"
	}
	if rule.Severity == "" {
		rule.Severity = "warning"
	}
	if rule.EvaluationPeriod <= 0 {
		rule.EvaluationPeriod = 60 // default 60s
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

// EvaluateRules runs the rule-evaluation engine.
//
// For every rule (or all enabled rules when ruleIDs is empty) the latest metric
// value is compared against the rule's threshold using the configured operator.
// When a rule fires, a new Alert is persisted.
//
// Returns one result entry per evaluated rule with fields:
//   - "rule_id", "rule_name", "metric", "current_value", "threshold"
//   - "status": "fired", "ok" or "skipped"
//   - "alert_id" (when fired)
//   - "message"
func (s *Service) EvaluateRules(ctx context.Context, tenantID string, ruleIDs []string) ([]map[string]interface{}, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	rules, err := s.repo.ListRules(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, fmt.Errorf("evaluate rules: list rules: %w", err)
	}

	// Build a lookup so callers can restrict evaluation to a subset.
	ruleFilter := make(map[string]struct{})
	for _, rid := range ruleIDs {
		ruleFilter[rid] = struct{}{}
	}

	var results []map[string]interface{}
	for _, rule := range rules {
		if len(ruleFilter) > 0 {
			if _, ok := ruleFilter[rule.ID]; !ok {
				// Rule not in the requested subset.
				continue
			}
		}
		results = append(results, s.evaluateSingleRule(ctx, tenantID, &rule))
	}

	return results, nil
}

// evaluateSingleRule evaluates one rule and returns a result map.
func (s *Service) evaluateSingleRule(ctx context.Context, tenantID string, rule *models.AlertRule) map[string]interface{} {
	res := map[string]interface{}{
		"rule_id":       rule.ID,
		"rule_name":     rule.Name,
		"metric":        rule.Metric,
		"threshold":     rule.Threshold,
		"operator":      rule.Operator,
		"severity":      rule.Severity,
		"status":        "ok",
		"current_value": nil,
		"message":       "rule evaluated",
	}

	if !rule.Enabled {
		res["status"] = "skipped"
		res["message"] = "rule is disabled"
		return res
	}
	if !rule.Active {
		res["status"] = "skipped"
		res["message"] = "rule is suppressed"
		return res
	}

	// Fetch the latest data point for the rule's metric.
	series, err := s.repo.GetMetricSeries(ctx, tenantID, rule.Metric, nil, nil, 1)
	if err != nil || len(series) == 0 {
		res["status"] = "skipped"
		if err != nil {
			res["message"] = fmt.Sprintf("failed to fetch metric data: %s", err.Error())
		} else {
			res["message"] = "no metric data available"
		}
		return res
	}
	currentValue := series[0].Value
	res["current_value"] = currentValue

	// Compare value against threshold using the configured operator.
	fired := compare(currentValue, rule.Operator, rule.Threshold)
	if !fired {
		res["message"] = fmt.Sprintf("%g %s %g: ok", currentValue, rule.Operator, rule.Threshold)
		return res
	}

	// Fire alert.
	alert := &models.Alert{
		TenantID: tenantID,
		RuleID:   rule.ID,
		Status:   "firing",
		Message:  fmt.Sprintf("%s: %g %s threshold %g", rule.Name, currentValue, rule.Operator, rule.Threshold),
		Value:    currentValue,
		Severity: rule.Severity,
	}
	if err := s.repo.CreateAlert(ctx, alert); err != nil {
		res["status"] = "error"
		res["message"] = fmt.Sprintf("failed to create alert: %s", err.Error())
		return res
	}
	res["status"] = "fired"
	res["alert_id"] = alert.ID
	res["message"] = fmt.Sprintf("alert fired: %g %s threshold %g", currentValue, rule.Operator, rule.Threshold)
	return res
}

// compare implements the alert operators: gt, lt, gte, lte, eq, neq.
func compare(value float64, operator string, threshold float64) bool {
	switch operator {
	case "gt":
		return value > threshold
	case "gte", ">=":
		return value >= threshold
	case "lt":
		return value < threshold
	case "lte", "<=":
		return value <= threshold
	case "eq":
		return value == threshold
	case "neq", "ne":
		return value != threshold
	default:
		return false
	}
}

// --- Alerts ---------------------------------------------------------

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

// EscalateAlert escalates a firing or acknowledged alert.
//
// Escalation steps:
//  1. Upgrade severity (info -> warning -> critical).
//  2. Reset the alert to "firing" so it re-notifies the on-call.
//  3. Persist a notification record carrying the escalation comment for audit.
//
// Returns the updated alert.
func (s *Service) EscalateAlert(ctx context.Context, tenantID, id string, comment string) (*models.Alert, error) {
	alert, err := s.repo.GetAlert(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if alert.Status == "resolved" {
		return nil, fmt.Errorf("cannot escalate a resolved alert: %s", id)
	}

	// Upgrade severity to the next level.
	newSeverity := escalateSeverity(alert.Severity)

	// Atomically bump severity and re-fire the alert.
	if err := s.repo.UpdateAlertStatus(ctx, tenantID, id, newSeverity, "firing"); err != nil {
		return nil, fmt.Errorf("escalate alert: %w", err)
	}

	// Persist escalation comment as a notification record for the audit trail.
	now := time.Now().UTC()
	nr := &models.NotificationRecord{
		TenantID:  tenantID,
		AlertID:   id,
		Status:    "sent",
		Message:   fmt.Sprintf("escalated to %s: %s", newSeverity, comment),
		SentAt:    now,
		CreatedAt: now,
	}
	if err := s.repo.CreateNotificationRecord(ctx, nr); err != nil {
		// Non-fatal: escalation succeeds even if audit record fails.
		_ = err
	}

	return s.repo.GetAlert(ctx, tenantID, id)
}

// escalateSeverity returns the next severity level, capping at "critical".
func escalateSeverity(current string) string {
	switch current {
	case "info":
		return "warning"
	case "warning":
		return "critical"
	default:
		return "critical"
	}
}

// --- Notification Channels ------------------------------------------

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

// --- Escalation Policies --------------------------------------------

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

// --- Notification History -------------------------------------------

func (s *Service) GetNotificationHistory(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error) {
	return s.repo.ListNotificationRecords(ctx, tenantID, limit, offset)
}

// --- Dashboard ------------------------------------------------------

// GetDashboard returns a summary view of the tenant's monitoring posture:
// total rules, active alerts, notification channels, widgets, and the top-5
// metrics by latest value.
func (s *Service) GetDashboard(ctx context.Context, tenantID string) (*models.DashboardSummary, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	rules, _ := s.repo.ListRules(ctx, tenantID, 500, 0)
	activeAlerts, _ := s.repo.ListActiveAlerts(ctx, tenantID, 500, 0)
	channels, _ := s.repo.ListChannels(ctx, tenantID, 500, 0)
	widgets, _ := s.repo.ListWidgetConfigs(ctx, tenantID, 500, 0)

	// Top metrics: latest value per registered metric (ordered by latest value desc).
	metrics, _ := s.repo.ListMetrics(ctx, tenantID, 100, 0)
	type metricValue struct {
		name  string
		value float64
	}
	var candidates []metricValue
	for _, m := range metrics {
		if !m.Enabled {
			continue
		}
		series, _ := s.repo.GetMetricSeries(ctx, tenantID, m.Name, nil, nil, 1)
		val := 0.0
		if len(series) > 0 {
			val = series[0].Value
		}
		candidates = append(candidates, metricValue{name: m.Name, value: val})
	}
	// Sort descending by value.
	for i := 0; i < len(candidates)-1; i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].value > candidates[i].value {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}

	topMetrics := make([]struct {
		Name  string  `json:"name"`
		Value float64 `json:"value"`
	}, 0, min(len(candidates), 5))
	for i := 0; i < len(candidates) && i < 5; i++ {
		c := candidates[i]
		topMetrics = append(topMetrics, struct {
			Name  string  `json:"name"`
			Value float64 `json:"value"`
		}{Name: c.name, Value: c.value})
	}

	return &models.DashboardSummary{
		TotalRules:    len(rules),
		ActiveAlerts:  len(activeAlerts),
		TotalChannels: len(channels),
		TotalWidgets:  len(widgets),
		TopMetrics:    topMetrics,
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

// GetAggregatedMetrics aggregates alert counts by severity and by rule, plus
// an overall metric summary computed from the latest registered metrics.
func (s *Service) GetAggregatedMetrics(ctx context.Context, tenantID string) (*models.AggregatedMetrics, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	// Alert counts by severity and status.
	alerts, err := s.repo.CountAlertsBySeverity(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("aggregated metrics: count alerts: %w", err)
	}
	bySeverity := map[string]models.SeverityCounts{}
	for _, a := range alerts {
		sev := a.Severity
		if sev == "" {
			sev = "warning"
		}
		sc := bySeverity[sev]
		switch a.Status {
		case "firing":
			sc.Firing++
		case "acknowledged":
			sc.Acknowledged++
		case "resolved":
			sc.Resolved++
		}
		bySeverity[sev] = sc
	}

	// Active alert counts per rule.
	byRule, err := s.repo.RuleAlertCounts(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("aggregated metrics: rule alert counts: %w", err)
	}

	// Overall: compute summary across the latest value of each metric.
	metrics, _ := s.repo.ListMetrics(ctx, tenantID, 100, 0)
	var (
		globalMin, globalMax, globalSum float64
		globalCount                     int
	)
	for _, m := range metrics {
		series, _ := s.repo.GetMetricSeries(ctx, tenantID, m.Name, nil, nil, 1)
		if len(series) == 0 {
			continue
		}
		v := series[0].Value
		globalSum += v
		if globalCount == 0 {
			globalMin, globalMax = v, v
		} else {
			globalMin = math.Min(globalMin, v)
			globalMax = math.Max(globalMax, v)
		}
		globalCount++
	}
	overall := models.MetricSummary{
		Min:         globalMin,
		Max:         globalMax,
		Avg:         globalSum / float64(globalCount),
		LastValue:   0,
		SampleCount: globalCount,
	}

	return &models.AggregatedMetrics{
		Overall:    overall,
		BySeverity: bySeverity,
		ByRule:     byRule,
	}, nil
}

// --- Anomalies ------------------------------------------------------

// DetectAnomalies scans every registered metric for statistical outliers using
// the z-score method (|z| > 3) and persists newly detected anomalies.
//
// The algorithm:
//  1. Fetch the last 30 data points for each enabled metric.
//  2. Compute mean and standard deviation.
//  3. For the most recent point, compute the z-score.
//  4. If |z| > 3, classify severity and create an anomaly record.
//
// Returns persisted anomalies ordered by detection time.
func (s *Service) DetectAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	metrics, err := s.repo.ListMetrics(ctx, tenantID, 200, 0)
	if err != nil {
		return nil, fmt.Errorf("detect anomalies: list metrics: %w", err)
	}

	for _, m := range metrics {
		if !m.Enabled {
			continue
		}
		series, err := s.repo.GetMetricSeries(ctx, tenantID, m.Name, nil, nil, 30)
		if err != nil || len(series) < 2 {
			// Need at least 2 points to compute a baseline.
			continue
		}
		anomaly := detectAnomalyForMetric(tenantID, m.Name, series)
		if anomaly != nil {
			if createErr := s.repo.CreateAnomaly(ctx, anomaly); createErr != nil {
				// Non-fatal: one metric failing does not abort the batch.
				_ = createErr
			}
		}
	}

	return s.repo.ListAnomalies(ctx, tenantID, limit, offset)
}

// detectAnomalyForMetric applies z-score anomaly detection to a metric series.
// Returns an Anomaly when the latest point is an outlier; nil otherwise.
func detectAnomalyForMetric(tenantID, metricName string, series []models.MetricSeriesPoint) *models.Anomaly {
	if len(series) < 2 {
		return nil
	}

	// Compute mean and standard deviation.
	n := len(series)
	var sum float64
	for i := 0; i < n; i++ {
		sum += series[i].Value
	}
	mean := sum / float64(n)
	var variance float64
	for i := 0; i < n; i++ {
		diff := series[i].Value - mean
		variance += diff * diff
	}
	stdDev := math.Sqrt(variance / float64(n))

	latest := series[n-1]
	if stdDev == 0 {
		// No variance means no anomaly possible.
		return nil
	}

	zScore := (latest.Value - mean) / stdDev
	if math.Abs(zScore) <= 3.0 {
		return nil
	}

	severity := classifySeverity(math.Abs(zScore))

	return &models.Anomaly{
		TenantID:    tenantID,
		Metric:      metricName,
		Score:       math.Round(zScore*100) / 100,
		Baseline:    math.Round(mean*100) / 100,
		Actual:      latest.Value,
		Severity:    severity,
		Description: fmt.Sprintf("z-score %.2f (mean %.2f, stddev %.2f)", zScore, mean, stdDev),
	}
}

func classifySeverity(absZ float64) string {
	switch {
	case absZ >= 4.0:
		return "critical"
	case absZ >= 3.5:
		return "warning"
	default:
		return "info"
	}
}

// GetAnomalySummary aggregates anomaly counts by severity and metric.
func (s *Service) GetAnomalySummary(ctx context.Context, tenantID string) (*models.AnomalySummary, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	// Use dedicated aggregation queries to avoid loading all rows into memory.
	byMetricRows, err := s.repo.CountAnomaliesByMetric(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("anomaly summary: count by metric: %w", err)
	}
	byMetric := make([]struct {
		Metric   string  `json:"metric"`
		Count    int     `json:"count"`
		AvgScore float64 `json:"avg_score"`
	}, 0, len(byMetricRows))
	for _, r := range byMetricRows {
		avg := math.Round(r.AvgScore*100) / 100
		byMetric = append(byMetric, struct {
			Metric   string  `json:"metric"`
			Count    int     `json:"count"`
			AvgScore float64 `json:"avg_score"`
		}{Metric: r.Metric, Count: r.Count, AvgScore: avg})
	}

	bySeverityRows, err := s.repo.CountAnomaliesBySeverity(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("anomaly summary: count by severity: %w", err)
	}
	bySeverity := make(map[string]int)
	for _, r := range bySeverityRows {
		bySeverity[r.Severity] = r.Count
	}

	totalAnomalies := 0
	for _, c := range bySeverity {
		totalAnomalies += c
	}

	last24h, _ := s.repo.CountAnomaliesLast24h(ctx, tenantID)

	return &models.AnomalySummary{
		TotalAnomalies: totalAnomalies,
		ByMetric:       byMetric,
		BySeverity:     bySeverity,
		Last24h:        last24h,
	}, nil
}

// --- System Collect -------------------------------------------------

// CollectSystemMetrics gathers Go runtime and host-level metrics and stores
// them as metric data points for later querying.
//
// Metrics collected:
//   - CPU: usage percent (caller-supplied, or 0 if omitted)
//   - Memory: heap allocation in MB (from runtime.MemStats)
//   - Disk: usage percent (caller-supplied, or 0 if omitted)
//   - Goroutines: runtime.NumGoroutine
//   - Uptime: runtime since process start
//   - Hostname: os.Hostname() or caller-supplied Host
//
// If caller-supplied values are nil, zero is recorded as the data point.
func (s *Service) CollectSystemMetrics(ctx context.Context, tenantID string, req models.CollectSystemMetricsRequest) (*models.SystemMetrics, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	hostname := req.Host
	if hostname == "" {
		h, err := os.Hostname()
		if err == nil {
			hostname = h
		}
	}
	if hostname == "" {
		hostname = "unknown"
	}

	cpu := 0.0
	if req.CPU != nil {
		cpu = *req.CPU
	}
	disk := 0.0
	if req.Disk != nil {
		disk = *req.Disk
	}

	// Compute host metric values and store them as metric data points.
	metricRecords := []struct {
		name  string
		value float64
	}{
		{"cpu_usage_percent", cpu},
		{"mem_heap_mb", float64(mem.HeapAlloc) / 1024 / 1024},
		{"mem_alloc_mb", float64(mem.TotalAlloc) / 1024 / 1024},
		{"disk_usage_percent", disk},
		{"goroutines", float64(runtime.NumGoroutine())},
	}

	for _, rec := range metricRecords {
		_ = s.repo.RecordMetric(ctx, tenantID, models.RecordMetricRequest{
			Name:   "system_" + rec.name,
			Value:  math.Round(rec.value*100) / 100,
			Labels: map[string]string{"host": hostname},
		})
	}

	return &models.SystemMetrics{
		Timestamp:  time.Now().UTC(),
		Host:       hostname,
		CPU:        cpu,
		Memory:     float64(mem.HeapAlloc) / 1024 / 1024,
		Disk:       disk,
		Goroutines: runtime.NumGoroutine(),
		UptimeSec:  float64(time.Since(runtimeMetricsStartTime).Seconds()),
		HTTPReqs:   0, // populated by gateway metrics when available
		Errors:     0, // populated by gateway metrics when available
	}, nil
}

// --- Errors ---------------------------------------------------------

var ErrNotFound = errors.New("not found")

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundResource(name string) error {
	return fmt.Errorf("%s not found: %w", name, sentinel.NotFound)
}

// --- Package-level constants ----------------------------------------

// runtimeMetricsStartTime records when this package was first initialized,
// used to compute process uptime in CollectSystemMetrics.
var runtimeMetricsStartTime = time.Now().UTC()
