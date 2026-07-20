package service

import (
	"context"
	"errors"
	"fmt"
	"math"

	"orion/platform-svc-go/internal/monitoring/models"
)

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
			// Skip metrics that are not enabled.
		} else {
			series, _ := s.repo.GetMetricSeries(ctx, tenantID, m.Name, nil, nil, 1)
			val := 0.0
			if len(series) > 0 {
				val = series[0].Value
			}
			candidates = append(candidates, metricValue{name: m.Name, value: val})
		}
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
