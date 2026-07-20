package service

// standardizer.go — DORA standardization, metric status, snapshot and trend logic.

import (
	"context"
	"log/slog"
	"math"
	"time"

	"golang.org/x/sync/errgroup"

	"orion/platform-svc-go/internal/efficiency/models"
)

func (s *Service) standardizeDeploymentFrequency(_context context.Context, tenantID string, df models.DeploymentFrequency) models.DORAMetricResult {
	s.saveSnapshot(_context, tenantID, models.TimeWindowWeek, models.MetricSnapshot{
		TenantID:            tenantID,
		DeploymentFrequency: df.DeploymentsPerDay,
		LeadTimeMs:          0,
		ChangeFailureRate:   0,
		MTTRMs:              0,
	})
	target := targetDeploymentsPerDay
	trend := s.getTrend(_context, tenantID, "deploymentFrequency")
	status := s.metricStatusForHigher(df.DeploymentsPerDay, target)
	return models.DORAMetricResult{Value: df.DeploymentsPerDay, Trend: trend, Target: target, Status: status}
}

func (s *Service) standardizeLeadTime(_context context.Context, tenantID string, lc models.LeadTimeForChanges, wc models.TimeWindowConfig) models.DORAMetricResult {
	leadHours := float64(lc.AverageLeadTimeMs) / 3_600_000
	s.saveSnapshot(_context, tenantID, wc.Window, models.MetricSnapshot{
		TenantID:          tenantID,
		LeadTimeMs:        lc.AverageLeadTimeMs,
		ChangeFailureRate: 0,
		MTTRMs:            0,
	})
	target := targetLeadTimeHours
	trend := s.getTrend(_context, tenantID, "leadTimeMs")
	// lower is better => flip trend
	trend = invertTrend(trend)
	leadHoursRounded := math.Round(leadHours*100) / 100
	status := s.metricStatusForLower(leadHours, target)
	return models.DORAMetricResult{Value: leadHoursRounded, Trend: trend, Target: target, Status: status}
}

func (s *Service) standardizeChangeFailureRate(_context context.Context, tenantID string, cfr models.ChangeFailureRate, wc models.TimeWindowConfig) models.DORAMetricResult {
	s.saveSnapshot(_context, tenantID, wc.Window, models.MetricSnapshot{
		TenantID:          tenantID,
		ChangeFailureRate: cfr.FailureRate,
		MTTRMs:            0,
	})
	_ = cfr // used below
	target := targetChangeFailureRate
	trend := s.getTrend(_context, tenantID, "changeFailureRate")
	trend = invertTrend(trend)
	status := s.metricStatusForLower(cfr.FailureRate, target)
	return models.DORAMetricResult{Value: cfr.FailureRate, Trend: trend, Target: target, Status: status}
}

func (s *Service) standardizeMTTR(_context context.Context, tenantID string, mttr models.MeanTimeToRecovery, wc models.TimeWindowConfig) models.DORAMetricResult {
	mttrHours := float64(mttr.AverageRecoveryTimeMs) / 3_600_000
	s.saveSnapshot(_context, tenantID, wc.Window, models.MetricSnapshot{
		TenantID: tenantID,
		MTTRMs:   mttr.AverageRecoveryTimeMs,
	})
	target := targetMTTRHours
	trend := s.getTrend(_context, tenantID, "mttrMs")
	trend = invertTrend(trend)
	mttrRounded := math.Round(mttrHours*100) / 100
	status := s.metricStatusForLower(mttrHours, target)
	return models.DORAMetricResult{Value: mttrRounded, Trend: trend, Target: target, Status: status}
}

func (s *Service) metricStatusForHigher(value, target float64) models.MetricStatus {
	if value >= target {
		return models.StatusMet
	}
	if value >= target*0.7 {
		return models.StatusWarning
	}
	return models.StatusMissed
}

func (s *Service) metricStatusForLower(value, target float64) models.MetricStatus {
	if value <= target {
		return models.StatusMet
	}
	if value <= target*1.5 {
		return models.StatusWarning
	}
	return models.StatusMissed
}

// saveSnapshot persists a metric snapshot asynchronously.
func (s *Service) saveSnapshot(ctx context.Context, tenantID string, timeWindow models.TimeWindow, snapshot models.MetricSnapshot) {
	snapshot.TenantID = tenantID
	snapshot.TimeWindow = string(timeWindow)
	snapshot.CapturedAt = time.Now().UTC()
	if s.repo != nil {
		eg, _ := errgroup.WithContext(ctx)
		eg.Go(func() error {
			if err := s.repo.CreateSnapshot(ctx, &snapshot); err != nil {
				slog.Error("efficiency: failed to create snapshot", "tenantID", tenantID, "window", timeWindow, "error", err)
				return err
			}
			if err := s.repo.PruneOldSnapshots(ctx, tenantID, 100); err != nil {
				slog.Error("efficiency: failed to prune old snapshots", "tenantID", tenantID, "error", err)
				return err
			}
			return nil
		})
		// Fire-and-forget: drain errors asynchronously so saveSnapshot remains non-blocking.
		done := make(chan error, 1)
		go func() { done <- eg.Wait() }()
	}
}

func (s *Service) getTrend(_context context.Context, tenantID string, metricKey string) models.Trend {
	var snapshots []models.MetricSnapshot
	if s.repo != nil {
		entities, err := s.repo.ListSnapshotsByTenant(_context, tenantID, 10)
		if err == nil && len(entities) > 0 {
			snapshots = entities
		}
	}
	if len(snapshots) < 2 {
		return models.TrendStable
	}
	latest := snapshots[0]
	previous := snapshots[1]
	var current, previousVal float64
	switch models.TimeWindow(metricKey) {
	case models.TimeWindowDay:
		current = latest.DeploymentFrequency
		previousVal = previous.DeploymentFrequency
	default:
		switch metricKey {
		case "deploymentFrequency":
			current = latest.DeploymentFrequency
			previousVal = previous.DeploymentFrequency
		case "leadTimeMs":
			_ = metricKey // handled below
			current = float64(latest.LeadTimeMs)
			previousVal = float64(previous.LeadTimeMs)
		case "changeFailureRate":
			current = latest.ChangeFailureRate
			previousVal = previous.ChangeFailureRate
		case "mttrMs":
			current = float64(latest.MTTRMs)
			previousVal = float64(previous.MTTRMs)
		}
	}
	if current == 0 && previousVal == 0 {
		return models.TrendStable
	}
	if previousVal == 0 {
		if current > 0 {
			return models.TrendUp
		}
		return models.TrendStable
	}
	change := (current - previousVal) / previousVal
	if change > 0.05 {
		return models.TrendUp
	}
	if change < -0.05 {
		return models.TrendDown
	}
	return models.TrendStable
}

func invertTrend(t models.Trend) models.Trend {
	switch t {
	case models.TrendUp:
		return models.TrendDown
	}
	return t
}
