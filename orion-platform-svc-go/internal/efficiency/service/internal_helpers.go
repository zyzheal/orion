package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"math"
	"time"

	"golang.org/x/sync/errgroup"

	"orion/platform-svc-go/internal/efficiency/models"
)

// ==================== Standardization (DORACalculator) ====================

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

// ==================== Snapshot / Trend ====================

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

// ==================== Period comparison helper ====================

func (s *Service) computePeriodMetrics(pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord, _start, _end time.Time, period models.PeriodSpec) models.PeriodMetrics {
	windowPipelines := filterSlice(pipelines, func(p models.PipelineCompletionRecord) bool {
		return !p.CompletedAt.Before(period.Start) && !p.CompletedAt.After(period.End)
	})
	successful := countBy(windowPipelines, func(p models.PipelineCompletionRecord) bool { return p.Status == "success" })
	successRate := 0.0
	var avgBuildMs int64
	if len(windowPipelines) > 0 {
		successRate = float64(successful) / float64(len(windowPipelines)) * 100
		total := int64(0)
		for _, p := range windowPipelines {
			total += p.DurationMs
		}
		avgBuildMs = total / int64(len(windowPipelines))
	}

	windowDeployments := filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(period.Start) && !d.DeployedAt.After(period.End)
	})
	failedDeps := countBy(windowDeployments, func(d models.DeploymentRecord) bool {
		return d.Status == "failed" || d.Status == "rolled_back"
	})
	cfr := 0.0
	if len(windowDeployments) > 0 {
		cfr = float64(failedDeps) / float64(len(windowDeployments)) * 100
	}

	return models.PeriodMetrics{
		Label:              period.Label,
		Start:              period.Start.Format(time.RFC3339),
		End:                period.End.Format(time.RFC3339),
		PipelineRuns:       len(windowPipelines),
		SuccessRate:        round2(successRate),
		AverageBuildTimeMs: avgBuildMs,
		Deployments:        len(windowDeployments),
		ChangeFailureRate:  round2(cfr),
	}
}

func (s *Service) computeChangePercent(oldValue, newValue float64) float64 {
	if oldValue == 0 {
		if newValue > 0 {
			return 100
		}
		return 0
	}
	return math.Round(((newValue-oldValue)/oldValue)*10000) / 100
}

// ==================== Persistence helpers ====================

func (s *Service) saveReportHistory(tenantID string, report *models.EfficiencyReport) {
	s.mu.Lock()
	defer s.mu.Unlock()
	history := s.reportHistory[tenantID]
	history = append(history, report)
	if len(history) > 50 {
		history = history[len(history)-50:]
	}
	s.reportHistory[tenantID] = history
}

func (s *Service) persistReportHistoryAsync(ctx context.Context, tenantID string, report *models.EfficiencyReport) {
	if s.repo == nil {
		return
	}
	data, err := json.Marshal(report)
	if err != nil {
		return
	}
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		if err := s.repo.CreateReportHistory(ctx, &models.ReportHistoryEntry{
			TenantID:    tenantID,
			ReportData:  string(data),
			GeneratedAt: report.GeneratedAt,
		}); err != nil {
			slog.Error("efficiency: failed to persist report history", "tenantID", tenantID, "error", err)
		}
		return nil
	})
	_ = eg.Wait()
}

func (s *Service) persistTeamDataAsync(ctx context.Context, tenantID, teamID, name string, members int, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord) error {
	if s.repo == nil {
		return nil
	}
	pdata, perr := json.Marshal(pipelines)
	ddata, derr := json.Marshal(deployments)
	if perr != nil || derr != nil {
		return nil
	}
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		if err := s.repo.CreateTeamData(ctx, &models.TeamData{
			ID: teamID, TenantID: tenantID, Name: name, Members: members,
			Pipelines: string(pdata), Deployments: string(ddata),
		}); err != nil {
			slog.Error("efficiency: failed to persist team data", "tenantID", tenantID, "teamID", teamID, "error", err)
		}
		return nil
	})
	_ = eg.Wait()
	return nil
}

func (s *Service) persistProjectDataAsync(ctx context.Context, tenantID, projectID, name string, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord, commits int) error {
	if s.repo == nil {
		return nil
	}
	pdata, perr := json.Marshal(pipelines)
	ddata, derr := json.Marshal(deployments)
	if perr != nil || derr != nil {
		return nil
	}
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		if err := s.repo.CreateProjectData(ctx, &models.ProjectData{
			ID: projectID, TenantID: tenantID, Name: name,
			Pipelines: string(pdata), Deployments: string(ddata), Commits: commits,
		}); err != nil {
			slog.Error("efficiency: failed to persist project data", "tenantID", tenantID, "projectID", projectID, "error", err)
		}
		return nil
	})
	_ = eg.Wait()
	return nil
}

func (s *Service) persistGlobalDeploymentsAsync(ctx context.Context, tenantID string, deployments []models.DeploymentRecord) error {
	if s.repo == nil {
		return nil
	}
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		if err := s.repo.DeleteGlobalDeploymentsByTenant(ctx, tenantID); err != nil {
			slog.Error("efficiency: failed to delete global deployments", "tenantID", tenantID, "error", err)
		}
		for _, d := range deployments {
			dData, _ := json.Marshal(d)
			if err := s.repo.CreateGlobalDeployment(ctx, &models.GlobalDeployment{
				TenantID: tenantID, DeploymentData: string(dData), DeployedAt: d.DeployedAt,
			}); err != nil {
				slog.Error("efficiency: failed to create global deployment", "tenantID", tenantID, "error", err)
			}
		}
		return nil
	})
	_ = eg.Wait()
	return nil
}

func (s *Service) persistGlobalPipelinesAsync(ctx context.Context, tenantID string, pipelines []models.PipelineCompletionRecord) error {
	if s.repo == nil {
		return nil
	}
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		if err := s.repo.DeleteGlobalPipelinesByTenant(ctx, tenantID); err != nil {
			slog.Error("efficiency: failed to delete global pipelines", "tenantID", tenantID, "error", err)
		}
		for _, p := range pipelines {
			pData, _ := json.Marshal(p)
			if err := s.repo.CreateGlobalPipeline(ctx, &models.GlobalPipeline{
				TenantID: tenantID, PipelineData: string(pData), CompletedAt: p.CompletedAt,
			}); err != nil {
				slog.Error("efficiency: failed to create global pipeline", "tenantID", tenantID, "error", err)
			}
		}
		return nil
	})
	_ = eg.Wait()
	return nil
}

// ==================== Cache access ====================

func (s *Service) getCachedData(tenantID string) ([]models.DeploymentRecord, []models.PipelineCompletionRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	deployments := make([]models.DeploymentRecord, len(s.globalDeployments[tenantID]))
	copy(deployments, s.globalDeployments[tenantID])
	pipelines := make([]models.PipelineCompletionRecord, len(s.globalPipelines[tenantID]))
	copy(pipelines, s.globalPipelines[tenantID])
	return deployments, pipelines
}

func (s *Service) getTeamPayload(tenantID, teamID string) *teamPayload {
	return s.teamData[tenantID][teamID]
}

func (s *Service) getProjectPayload(tenantID, projectID string) *projectPayload {
	return s.projectData[tenantID][projectID]
}

// ==================== Load from repo ====================

func (s *Service) loadAllFromRepo(ctx context.Context) error {
	// Team data
	teams, err := s.repo.ListTeamData(ctx, "default")
	if err == nil {
		s.mu.Lock()
		s.teamData["default"] = make(map[string]*teamPayload, len(teams))
		for _, t := range teams {
			var pipelines []models.PipelineCompletionRecord
			var deployments []models.DeploymentRecord
			_ = json.Unmarshal([]byte(t.Pipelines), &pipelines)
			_ = json.Unmarshal([]byte(t.Deployments), &deployments)
			s.teamData["default"][t.ID] = &teamPayload{
				Name: t.Name, Members: t.Members, Pipelines: pipelines, Deployments: deployments,
			}
		}
		s.mu.Unlock()
	}

	// Project data
	projects, err := s.repo.ListProjectData(ctx, "default")
	if err == nil {
		s.mu.Lock()
		s.projectData["default"] = make(map[string]*projectPayload, len(projects))
		for _, p := range projects {
			var pipelines []models.PipelineCompletionRecord
			var deployments []models.DeploymentRecord
			_ = json.Unmarshal([]byte(p.Pipelines), &pipelines)
			_ = json.Unmarshal([]byte(p.Deployments), &deployments)
			s.projectData["default"][p.ID] = &projectPayload{
				Name: p.Name, Pipelines: pipelines, Deployments: deployments, Commits: p.Commits,
			}
		}
		s.mu.Unlock()
	}

	// Report history
	entries, err := s.repo.ListReportHistory(ctx, "default", 50)
	if err == nil && len(entries) > 0 {
		s.mu.Lock()
		for i := len(entries) - 1; i >= 0; i-- {
			var r models.EfficiencyReport
			if err := json.Unmarshal([]byte(entries[i].ReportData), &r); err == nil {
				s.reportHistory["default"] = append(s.reportHistory["default"], &r)
			}
		}
		s.mu.Unlock()
	}

	// Global deployments
	deployments, err := s.repo.ListGlobalDeployments(ctx, "default")
	if err == nil {
		s.mu.Lock()
		for _, d := range deployments {
			var dr models.DeploymentRecord
			if err := json.Unmarshal([]byte(d.DeploymentData), &dr); err == nil {
				s.globalDeployments["default"] = append(s.globalDeployments["default"], dr)
			}
		}
		s.mu.Unlock()
	}

	// Global pipelines
	pipelines, err := s.repo.ListGlobalPipelines(ctx, "default")
	if err == nil {
		s.mu.Lock()
		for _, p := range pipelines {
			var pr models.PipelineCompletionRecord
			if err := json.Unmarshal([]byte(p.PipelineData), &pr); err == nil {
				s.globalPipelines["default"] = append(s.globalPipelines["default"], pr)
			}
		}
		s.mu.Unlock()
	}

	return nil
}
