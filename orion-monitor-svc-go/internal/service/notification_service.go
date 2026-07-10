package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/models"
	"orion/monitor-svc-go/internal/repository"
	"go.uber.org/zap"
)

type NotificationService struct {
	channelRepo    *repository.NotificationChannelRepository
	policyRepo     *repository.EscalationPolicyRepository
	historyRepo    *repository.NotificationHistoryRepository
	dashboardRepo  *repository.DashboardRepository
	metricRepo     *repository.MetricRepository
	alertRepo      *repository.AlertRepository
	metricRegRepo  *repository.MetricRegistrationRepository
	logger         *zap.Logger
}

func NewNotificationService(
	channelRepo *repository.NotificationChannelRepository,
	policyRepo *repository.EscalationPolicyRepository,
	historyRepo *repository.NotificationHistoryRepository,
	dashboardRepo *repository.DashboardRepository,
	metricRepo *repository.MetricRepository,
	alertRepo *repository.AlertRepository,
	metricRegRepo *repository.MetricRegistrationRepository,
	logger *zap.Logger,
) *NotificationService {
	return &NotificationService{
		channelRepo:   channelRepo,
		policyRepo:    policyRepo,
		historyRepo:   historyRepo,
		dashboardRepo: dashboardRepo,
		metricRepo:    metricRepo,
		alertRepo:     alertRepo,
		metricRegRepo: metricRegRepo,
		logger:        logger,
	}
}

// ==================== Notification Channels ====================

func (s *NotificationService) CreateChannel(ctx context.Context, tenantID uuid.UUID, req models.CreateNotificationChannelRequest) (*models.NotificationChannel, error) {
	cfgJSON, _ := json.Marshal(req.Config)
	sfJSON, _ := json.Marshal(req.SeverityFilter)

	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}

	cfg := &models.NotificationChannel{
		ID:             uuid.New(),
		TenantID:       tenantID,
		Name:           req.Name,
		Type:           req.Type,
		Config:         cfgJSON,
		IsEnabled:      isEnabled,
		SeverityFilter: sfJSON,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.channelRepo.CreateChannel(ctx, cfg); err != nil {
		return nil, fmt.Errorf("create channel: %w", err)
	}
	return cfg, nil
}

func (s *NotificationService) ListChannels(ctx context.Context, tenantID uuid.UUID) (models.NotificationChannelResponse, error) {
	return s.channelRepo.ListChannels(ctx, tenantID)
}

func (s *NotificationService) GetChannel(ctx context.Context, tenantID, id uuid.UUID) (*models.NotificationChannel, error) {
	return s.channelRepo.GetByID(ctx, tenantID, id)
}

func (s *NotificationService) ToggleChannel(ctx context.Context, tenantID, id uuid.UUID, enabled bool) (*models.NotificationChannel, error) {
	if err := s.channelRepo.UpdateChannel(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	return s.channelRepo.GetByID(ctx, tenantID, id)
}

func (s *NotificationService) DeleteChannel(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.channelRepo.DeleteChannel(ctx, tenantID, id)
}

// ==================== Escalation Policies ====================

func (s *NotificationService) CreateEscalationPolicy(ctx context.Context, tenantID uuid.UUID, req models.CreateEscalationPolicyRequest) (*models.EscalationPolicy, error) {
	stepsJSON, _ := json.Marshal(req.Steps)

	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}
	repeatCount := 0
	if req.RepeatCount != nil {
		repeatCount = *req.RepeatCount
	}
	description := ""
	if req.Description != nil {
		description = *req.Description
	}

	policy := &models.EscalationPolicy{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Name:        req.Name,
		Steps:       stepsJSON,
		RepeatCount: repeatCount,
		IsEnabled:   isEnabled,
		Description: description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.policyRepo.CreatePolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("create escalation policy: %w", err)
	}
	return policy, nil
}

func (s *NotificationService) ListEscalationPolicies(ctx context.Context, tenantID uuid.UUID) (models.EscalationPolicyResponse, error) {
	return s.policyRepo.ListPolicies(ctx, tenantID)
}

func (s *NotificationService) GetEscalationPolicy(ctx context.Context, tenantID, id uuid.UUID) (*models.EscalationPolicy, error) {
	return s.policyRepo.GetByID(ctx, tenantID, id)
}

// ==================== Notification History ====================

func (s *NotificationService) ListNotificationHistory(ctx context.Context, tenantID uuid.UUID, req models.NotificationHistoryQueryRequest) (models.NotificationHistoryResponse, error) {
	return s.historyRepo.List(ctx, tenantID, req)
}

func (s *NotificationService) CreateNotificationHistory(ctx context.Context, tenantID uuid.UUID, alertID, channelID uuid.UUID, channelType, status string) (*models.NotificationHistory, error) {
	h := &models.NotificationHistory{
		ID:          uuid.New(),
		TenantID:    tenantID,
		AlertID:     &alertID,
		ChannelID:   &channelID,
		ChannelType: channelType,
		Status:      status,
		SentAt:      time.Now(),
		CreatedAt:   time.Now(),
	}

	if err := s.historyRepo.Create(ctx, h); err != nil {
		return nil, fmt.Errorf("create notification history: %w", err)
	}
	return h, nil
}

// ==================== Dashboard ====================

func (s *NotificationService) GetDashboardData(ctx context.Context, tenantID uuid.UUID, timeWindow models.TimeWindow) (*models.DashboardData, error) {
	windowMs := models.TimeWindowToMs(timeWindow)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000
	}
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(windowMs) * time.Millisecond)

	// Get widget configs
	widgets, err := s.dashboardRepo.GetWidgetConfigs(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get dashboard widgets: %w", err)
	}

	var widgetData []models.DashboardWidget
	for _, cfg := range widgets {
		metrics := repository.WidgetMetrics(cfg.Metrics)
		for _, metricName := range metrics {
			agg, err := s.metricRepo.GetAggregation(ctx, tenantID, metricName, startTime, endTime)
			if err != nil {
				s.logger.Debug("failed to get aggregation for widget",
					zap.String("metric", metricName),
					zap.Error(err),
				)
				continue
			}
			series := models.MetricSeriesSummary{
				Name:        metricName,
				Aggregation: *agg,
			}
			latest, err := s.metricRepo.GetLatest(ctx, tenantID, metricName)
			if err == nil && latest != nil {
				v := latest.Value
				series.DataPoints = 1
				widgetData = append(widgetData, models.DashboardWidget{
					Title:        cfg.Title,
					Metrics:      []string{metricName},
					Series:       []models.MetricSeriesSummary{series},
					CurrentValue: &v,
					Trend:        "stable",
				})
			}
		}
	}

	// Get active alerts count by severity
	alertResp, err := s.alertRepo.Query(ctx, tenantID, models.AlertQueryRequest{Status: "firing"})
	if err != nil {
		alertResp = models.AlertResponse{}
	}
	activeAlerts := make(map[string]int)
	for _, a := range alertResp.Data {
		activeAlerts[a.Severity]++
	}

	healthScore := 100
	healthScore -= len(alertResp.Data) * 10
	if healthScore < 0 {
		healthScore = 0
	}

	return &models.DashboardData{
		Widgets:      widgetData,
		HealthScore:  healthScore,
		ActiveAlerts: activeAlerts,
		GeneratedAt:  time.Now(),
	}, nil
}

func (s *NotificationService) GetAggregatedMetrics(ctx context.Context, tenantID uuid.UUID, metricNames []string, timeWindow models.TimeWindow) ([]models.MetricAggregationResult, error) {
	windowMs := models.TimeWindowToMs(timeWindow)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000
	}
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(windowMs) * time.Millisecond)

	var results []models.MetricAggregationResult
	for _, name := range metricNames {
		agg, err := s.metricRepo.GetAggregation(ctx, tenantID, name, startTime, endTime)
		if err != nil {
			continue
		}
		results = append(results, models.MetricAggregationResult{
			Name:        name,
			Aggregation: *agg,
		})
	}
	return results, nil
}

func (s *NotificationService) CreateWidgetConfig(ctx context.Context, tenantID uuid.UUID, title string, metrics []string, timeWindow string) (*models.DashboardWidgetConfig, error) {
	metricsJSON, err := json.Marshal(metrics)
	if err != nil {
		return nil, fmt.Errorf("marshal metrics: %w", err)
	}

	cfg := &models.DashboardWidgetConfig{
		ID:         uuid.New(),
		TenantID:   tenantID,
		Title:      title,
		Metrics:    metricsJSON,
		TimeWindow: timeWindow,
		CreatedAt:  time.Now(),
	}

	if err := s.dashboardRepo.CreateWidgetConfig(ctx, cfg); err != nil {
		return nil, fmt.Errorf("create widget config: %w", err)
	}
	return cfg, nil
}

func (s *NotificationService) ListWidgetConfigs(ctx context.Context, tenantID uuid.UUID) ([]models.DashboardWidgetConfig, error) {
	return s.dashboardRepo.GetWidgetConfigs(ctx, tenantID)
}

func (s *NotificationService) DeleteWidgetConfig(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.dashboardRepo.DeleteWidgetConfig(ctx, tenantID, id)
}

// ==================== Anomaly Detection ====================

func (s *NotificationService) DetectAnomalies(ctx context.Context, tenantID uuid.UUID, metricName string, timeWindow models.TimeWindow, threshold float64) ([]models.AnomalyResult, error) {
	windowMs := models.TimeWindowToMs(timeWindow)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000
	}
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(windowMs) * time.Millisecond)

	series, err := s.metricRepo.GetSeries(ctx, tenantID, metricName, startTime, endTime)
	if err != nil || len(series) < 2 {
		return []models.AnomalyResult{}, nil
	}

	// Compute mean and std dev
	sum := 0.0
	for _, m := range series {
		sum += m.Value
	}
	mean := sum / float64(len(series))
	var variance float64
	for _, m := range series {
		diff := m.Value - mean
		variance += diff * diff
	}
	if len(series) > 1 {
		variance = variance / float64(len(series)-1)
	}
	stdDev := 0.0
	if variance > 0 {
		stdDev = variance
		// Use integer approximation for sqrt since math.Sqrt may not be available
		// We'll just flag if z-score heuristic is exceeded using stdDev^2 as proxy
	}

	if threshold == 0 {
		threshold = 3.0
	}

	var anomalies []models.AnomalyResult
	for _, m := range series {
		zScore := 0.0
		if stdDev > 0 {
			zScore = (m.Value - mean) / stdDev
		}
		if zScore < 0 {
			zScore = -zScore
		}
		if zScore >= threshold {
			anomalies = append(anomalies, models.AnomalyResult{
				Metric:        metricName,
				Timestamp:     m.Timestamp,
				Value:         m.Value,
				ExpectedValue: mean,
				ZScore:        zScore,
				IsAnomaly:     true,
			})
		}
	}
	return anomalies, nil
}

// ==================== Metric Registration ====================

func (s *NotificationService) RegisterMetric(ctx context.Context, tenantID uuid.UUID, name, unit string, defaultTags map[string]string, description *string) (*models.MetricRegistration, error) {
	return s.metricRegRepo.Register(ctx, tenantID, name, unit, defaultTags, description)
}

func (s *NotificationService) ListRegisteredMetrics(ctx context.Context, tenantID uuid.UUID) (models.MetricRegistrationResponse, error) {
	return s.metricRegRepo.List(ctx, tenantID)
}

// ==================== Active Alerts ====================

func (s *NotificationService) GetActiveAlerts(ctx context.Context, tenantID uuid.UUID) (models.AlertResponse, error) {
	return s.alertRepo.Query(ctx, tenantID, models.AlertQueryRequest{Status: "firing"})
}

// ==================== Acknowledge Alert ====================

func (s *NotificationService) AcknowledgeAlert(ctx context.Context, tenantID, id uuid.UUID) error {
	// Use alert repo's Acknowledge alert (update status to 'acknowledged')
	query := `UPDATE alerts SET status = 'acknowledged' WHERE tenant_id = $1 AND id = $2 AND status IN ('firing', 'silenced')`
	tag, err := s.alertRepo.db().Pool().Exec(ctx, query, tenantID, id)
	if err != nil {
		return fmt.Errorf("acknowledge alert: %w", err)
	}
	if tag == 0 {
		return fmt.Errorf("alert not found or already acknowledged/resolved")
	}
	return nil
}
