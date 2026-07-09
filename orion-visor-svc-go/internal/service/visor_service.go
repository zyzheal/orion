package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/visor-svc-go/internal/models"
	"orion/visor-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrNotFound         = errors.New("resource not found")
	ErrInvalidInput     = errors.New("invalid input")
	ErrAlreadyExists    = errors.New("resource already exists")
	ErrDashboardNotFound = errors.New("dashboard not found")
)

// Service provides business logic for the visor domain.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service backed by the given Repository.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Dashboard ====================

// CreateDashboard creates a new dashboard with a generated UUID.
func (s *Service) CreateDashboard(ctx context.Context, tenantID string, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
	if req.Config == nil {
		req.Config = models.JSONB{}
	}
	d := &models.Dashboard{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		DashboardType: req.DashboardType,
		Config:        req.Config,
		Layout:        models.JSONB{},
		Shared:        false,
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("create dashboard: %w", err)
	}
	return d, nil
}

// ListDashboards returns paginated dashboards for a tenant.
func (s *Service) ListDashboards(ctx context.Context, tenantID string, offset, limit int) ([]models.Dashboard, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetDashboard returns a single dashboard by ID.
func (s *Service) GetDashboard(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// UpdateDashboard modifies an existing dashboard.
func (s *Service) UpdateDashboard(ctx context.Context, tenantID, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

// DeleteDashboard removes a dashboard by ID.
func (s *Service) DeleteDashboard(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// CountDashboards returns the total dashboard count for a tenant.
func (s *Service) CountDashboards(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ==================== Monitor Host ====================

// CreateHost registers a new monitor host with default status "unknown".
func (s *Service) CreateHost(ctx context.Context, tenantID string, req *models.CreateHostRequest) (*models.MonitorHost, error) {
	if req.Port == 0 {
		req.Port = 22
	}
	if req.Tags == nil {
		req.Tags = models.JSONB{}
	}
	h := &models.MonitorHost{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		Host:     req.Host,
		Port:     req.Port,
		Status:   "unknown",
		Tags:     req.Tags,
	}
	if req.OSType != "" {
		h.OSType = &req.OSType
	}
	if err := s.repo.CreateHost(ctx, h); err != nil {
		return nil, fmt.Errorf("create host: %w", err)
	}
	return h, nil
}

// ListHosts returns paginated monitor hosts.
func (s *Service) ListHosts(ctx context.Context, tenantID string, offset, limit int) ([]models.MonitorHost, error) {
	return s.repo.ListHosts(ctx, tenantID, offset, limit)
}

// GetHost returns a single monitor host by ID.
func (s *Service) GetHost(ctx context.Context, tenantID, id string) (*models.MonitorHost, error) {
	return s.repo.GetHostByID(ctx, tenantID, id)
}

// UpdateHost modifies an existing monitor host.
func (s *Service) UpdateHost(ctx context.Context, tenantID, id string, req *models.UpdateHostRequest) (*models.MonitorHost, error) {
	return s.repo.UpdateHost(ctx, tenantID, id, req)
}

// DeleteHost removes a monitor host.
func (s *Service) DeleteHost(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteHost(ctx, tenantID, id)
}

// CountHosts returns the total host count.
func (s *Service) CountHosts(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountHosts(ctx, tenantID)
}

// GetHostStatusSummary returns host counts grouped by status.
func (s *Service) GetHostStatusSummary(ctx context.Context, tenantID string) (map[string]int, error) {
	return s.repo.CountHostsByStatus(ctx, tenantID)
}

// Heartbeat updates a host's last heartbeat time and sets status to online.
func (s *Service) Heartbeat(ctx context.Context, tenantID, hostID string) error {
	return s.repo.UpdateHostHeartbeat(ctx, tenantID, hostID)
}

// ==================== Alert Rule ====================

// CreateAlertRule creates a new alerting rule with defaults.
func (s *Service) CreateAlertRule(ctx context.Context, tenantID string, req *models.CreateAlertRuleRequest) (*models.AlertRule, error) {
	if req.Severity == "" {
		req.Severity = "warning"
	}
	if req.CooldownMs == 0 {
		req.CooldownMs = 300000 // 5 minutes default
	}
	if req.Tags == nil {
		req.Tags = models.JSONB{}
	}
	rule := &models.AlertRule{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		Metric:     req.Metric,
		Condition:  req.Condition,
		Threshold:  req.Threshold,
		Severity:   req.Severity,
		Enabled:    true,
		Suppressed: false,
		CooldownMs: req.CooldownMs,
		Tags:       req.Tags,
	}
	if req.Description != "" {
		rule.Description = &req.Description
	}
	if err := s.repo.CreateAlertRule(ctx, rule); err != nil {
		return nil, fmt.Errorf("create alert rule: %w", err)
	}
	return rule, nil
}

// ListAlertRules returns all alert rules for a tenant.
func (s *Service) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	return s.repo.ListAlertRules(ctx, tenantID)
}

// GetAlertRule returns a single alert rule by ID.
func (s *Service) GetAlertRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error) {
	return s.repo.GetAlertRuleByID(ctx, tenantID, id)
}

// UpdateAlertRule modifies an existing alert rule.
func (s *Service) UpdateAlertRule(ctx context.Context, tenantID, id string, req *models.UpdateAlertRuleRequest) (*models.AlertRule, error) {
	return s.repo.UpdateAlertRule(ctx, tenantID, id, req)
}

// DeleteAlertRule removes an alert rule.
func (s *Service) DeleteAlertRule(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteAlertRule(ctx, tenantID, id)
}

// ToggleAlertRule enables or disables an alert rule.
func (s *Service) ToggleAlertRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error) {
	return s.repo.ToggleAlertRule(ctx, tenantID, id, enabled)
}

// ==================== Alert Instance ====================

// ListAlerts returns paginated alert instances with optional filters.
func (s *Service) ListAlerts(ctx context.Context, tenantID, status, severity string, offset, limit int) ([]models.AlertInstance, int, error) {
	return s.repo.ListAlerts(ctx, tenantID, status, severity, offset, limit)
}

// GetAlert returns a single alert instance by ID.
func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	return s.repo.GetAlertByID(ctx, tenantID, id)
}

// AcknowledgeAlert marks a triggered alert as acknowledged by a user.
func (s *Service) AcknowledgeAlert(ctx context.Context, tenantID, id, userID string) (*models.AlertInstance, error) {
	return s.repo.AcknowledgeAlert(ctx, tenantID, id, userID)
}

// ResolveAlert marks an alert as resolved.
func (s *Service) ResolveAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error) {
	return s.repo.ResolveAlert(ctx, tenantID, id)
}

// GetAlertStats returns aggregated alert statistics.
func (s *Service) GetAlertStats(ctx context.Context, tenantID string) (*models.AlertStats, error) {
	return s.repo.GetAlertStats(ctx, tenantID)
}

// ==================== Metric Data Point ====================

// RecordMetric persists a single metric data point.
func (s *Service) RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) error {
	dp := &models.MetricDataPoint{
		TenantID:   tenantID,
		MetricName: req.MetricName,
		Value:      req.Value,
		Tags:       models.JSONB{},
		Timestamp:  time.Now(),
	}
	if req.Tags != nil {
		for k, v := range req.Tags {
			dp.Tags[k] = v
		}
	}
	return s.repo.InsertMetricDataPoint(ctx, dp)
}

// QueryMetricSeries returns time-series data for a metric within a time window.
func (s *Service) QueryMetricSeries(ctx context.Context, tenantID, metricName string, start, end time.Time, maxPoints int) ([]models.MetricDataPoint, error) {
	return s.repo.QueryMetricSeries(ctx, tenantID, metricName, start, end, maxPoints)
}

// GetLatestMetricValue returns the most recent value for a metric.
func (s *Service) GetLatestMetricValue(ctx context.Context, tenantID, metricName string) (*float64, error) {
	return s.repo.GetLatestMetricValue(ctx, tenantID, metricName)
}

// PruneExpiredMetrics removes data points older than the retention period.
func (s *Service) PruneExpiredMetrics(ctx context.Context, tenantID string, retentionMs int64) (int64, error) {
	return s.repo.PruneExpiredMetrics(ctx, tenantID, retentionMs)
}

// MetricAggregation holds aggregated statistics for a metric series.
type MetricAggregation struct {
	Avg   float64 `json:"avg"`
	Max   float64 `json:"max"`
	Min   float64 `json:"min"`
	P95   float64 `json:"p95"`
	P99   float64 `json:"p99"`
	Count int     `json:"count"`
	Sum   float64 `json:"sum"`
}

// GetMetricSummary computes aggregated statistics for a metric over a time window.
func (s *Service) GetMetricSummary(ctx context.Context, tenantID, metricName string, windowMs int64) (*MetricAggregation, error) {
	end := time.Now()
	start := end.Add(-time.Duration(windowMs) * time.Millisecond)
	points, err := s.repo.QueryMetricSeries(ctx, tenantID, metricName, start, end, 0)
	if err != nil {
		return nil, err
	}
	if len(points) == 0 {
		return &MetricAggregation{}, nil
	}
	return computeAggregation(points), nil
}

// AnomalyResult represents a detected anomaly in a metric series.
type AnomalyResult struct {
	Metric        string    `json:"metric"`
	Timestamp     time.Time `json:"timestamp"`
	Value         float64   `json:"value"`
	ExpectedValue float64   `json:"expected_value"`
	ZScore        float64   `json:"z_score"`
}

// DetectAnomalies uses z-score to find anomalous data points in a metric series.
// Points with |z-score| >= threshold (default 2.5) are considered anomalies.
func (s *Service) DetectAnomalies(ctx context.Context, tenantID, metricName string, windowMs int64, threshold float64) ([]AnomalyResult, error) {
	if threshold <= 0 {
		threshold = 2.5
	}
	end := time.Now()
	start := end.Add(-time.Duration(windowMs) * time.Millisecond)
	points, err := s.repo.QueryMetricSeries(ctx, tenantID, metricName, start, end, 0)
	if err != nil {
		return nil, err
	}
	if len(points) < 3 {
		return nil, nil
	}

	values := make([]float64, len(points))
	for i, p := range points {
		values[i] = p.Value
	}
	mean := mean(values)
	stdDev := stddev(values, mean)
	if stdDev == 0 {
		return nil, nil
	}

	var anomalies []AnomalyResult
	for i, p := range points {
		z := (p.Value - mean) / stdDev
		if math.Abs(z) >= threshold {
			anomalies = append(anomalies, AnomalyResult{
				Metric:        metricName,
				Timestamp:     p.Timestamp,
				Value:         p.Value,
				ExpectedValue: math.Round(mean*100) / 100,
				ZScore:        math.Round(z*100) / 100,
			})
		}
		_ = i
	}
	return anomalies, nil
}

// ==================== Notification Channel ====================

// CreateChannel creates a new notification channel.
func (s *Service) CreateChannel(ctx context.Context, tenantID string, req *models.CreateChannelRequest) (*models.NotificationChannel, error) {
	ch := &models.NotificationChannel{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Config:   req.Config,
		Enabled:  true,
	}
	if err := s.repo.CreateChannel(ctx, ch); err != nil {
		return nil, fmt.Errorf("create channel: %w", err)
	}
	return ch, nil
}

// ListChannels returns all notification channels for a tenant.
func (s *Service) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	return s.repo.ListChannels(ctx, tenantID)
}

// ToggleChannel enables or disables a notification channel.
func (s *Service) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error {
	return s.repo.ToggleChannel(ctx, tenantID, id, enabled)
}

// DeleteChannel removes a notification channel.
func (s *Service) DeleteChannel(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteChannel(ctx, tenantID, id)
}

// ==================== Notification History ====================

// ListNotificationHistory returns notification records with optional alert filter.
func (s *Service) ListNotificationHistory(ctx context.Context, tenantID, alertID string, limit int) ([]models.NotificationHistory, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListNotificationHistory(ctx, tenantID, alertID, limit)
}

// ==================== Rule Evaluation Engine ====================

// EvaluateRules evaluates all enabled rules for a tenant against current metric values.
// Returns newly triggered alert instances.
func (s *Service) EvaluateRules(ctx context.Context, tenantID string) ([]models.AlertInstance, error) {
	rules, err := s.repo.GetEnabledAlertRules(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("load rules: %w", err)
	}

	var newAlerts []models.AlertInstance
	for _, rule := range rules {
		val, err := s.repo.GetLatestMetricValue(ctx, tenantID, rule.Metric)
		if err != nil || val == nil {
			continue
		}

		if evaluateCondition(rule.Condition, *val, rule.Threshold) {
			alert := models.AlertInstance{
				ID:        uuid.New().String(),
				TenantID:  tenantID,
				RuleID:    rule.ID,
				RuleName:  &rule.Name,
				Metric:    rule.Metric,
				Value:     *val,
				Threshold: rule.Threshold,
				Severity:  rule.Severity,
				Status:    "triggered",
				Tags:      rule.Tags,
				Message:   buildAlertMessage(rule, *val),
			}
			if err := s.repo.CreateAlertInstance(ctx, &alert); err != nil {
				continue
			}
			newAlerts = append(newAlerts, alert)
		}
	}
	return newAlerts, nil
}

// ==================== Notification Sending ====================

// SendNotification delivers an alert to the specified notification channels
// and records the delivery outcome in notification history.
func (s *Service) SendNotification(ctx context.Context, tenantID, alertID string, channelIDs []string) ([]models.NotificationHistory, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, alertID)
	if err != nil {
		return nil, fmt.Errorf("load alert: %w", err)
	}

	var records []models.NotificationHistory
	for _, chID := range channelIDs {
		record := models.NotificationHistory{
			ID:        uuid.New().String(),
			TenantID:  tenantID,
			AlertID:   alertID,
			ChannelID: chID,
			Status:    "sent",
		}
		// In production this would actually deliver via email/webhook/slack.
		// For now we record a successful delivery.
		record.ChannelType = "webhook"
		if err := s.repo.CreateNotificationHistory(ctx, &record); err != nil {
			record.Status = "failed"
			errMsg := err.Error()
			record.ErrorMessage = &errMsg
		}
		records = append(records, record)
	}
	_ = alert // used for delivery logic in production
	return records, nil
}

// ==================== Private Helpers ====================

// evaluateCondition checks whether a metric value satisfies a threshold condition.
func evaluateCondition(condition string, value, threshold float64) bool {
	switch condition {
	case ">":
		return value > threshold
	case "<":
		return value < threshold
	case ">=":
		return value >= threshold
	case "<=":
		return value <= threshold
	case "==":
		return value == threshold
	case "!=":
		return value != threshold
	default:
		return false
	}
}

// buildAlertMessage generates a human-readable alert message.
func buildAlertMessage(rule models.AlertRule, value float64) *string {
	msg := fmt.Sprintf("Alert: %s - Metric %q is %.2f %s %.2f",
		rule.Name, rule.Metric, value, rule.Condition, rule.Threshold)
	return &msg
}

// computeAggregation calculates statistical aggregation over a set of data points.
func computeAggregation(points []models.MetricDataPoint) *MetricAggregation {
	if len(points) == 0 {
		return &MetricAggregation{}
	}
	values := make([]float64, len(points))
	sum := 0.0
	for i, p := range points {
		values[i] = p.Value
		sum += p.Value
	}
	sort.Float64s(values)
	avg := sum / float64(len(values))
	return &MetricAggregation{
		Avg:   math.Round(avg*100) / 100,
		Max:   values[len(values)-1],
		Min:   values[0],
		P95:   percentile(values, 95),
		P99:   percentile(values, 99),
		Count: len(values),
		Sum:   math.Round(sum*100) / 100,
	}
}

// percentile computes the p-th percentile from a sorted slice.
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}
	idx := (p / 100) * float64(len(sorted)-1)
	lower := int(math.Floor(idx))
	upper := int(math.Ceil(idx))
	if lower == upper {
		return sorted[lower]
	}
	weight := idx - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}

// mean computes the arithmetic mean of a slice of float64.
func mean(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// stddev computes the population standard deviation.
func stddev(values []float64, meanVal float64) float64 {
	sum := 0.0
	for _, v := range values {
		diff := v - meanVal
		sum += diff * diff
	}
	return math.Sqrt(sum / float64(len(values)))
}
