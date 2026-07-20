package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"sync"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"

	"github.com/google/uuid"
	"orion/go-common/pkg/sentinel"
)

// GetAllDORA computes all four standard DORA metrics.
func (s *Service) GetAllDORA(ctx context.Context, tenantID string, deployments []models.DeploymentRecord, pipelines []models.PipelineCompletionRecord, incidents []models.IncidentRecord, timeWindow models.TimeWindow, windowSize int) (*models.AllDORAResult, error) {
	if windowSize <= 0 {
		windowSize = 1
	}
	windowConfig := s.buildTimeWindow(timeWindow, windowSize)

	deploymentFreq := s.calculateDeploymentFrequency(deployments, windowConfig)
	leadTime := s.calculateLeadTimeForChanges(pipelines, windowConfig, deployments)
	failureRate := s.calculateChangeFailureRate(deployments, windowConfig)
	mttr := s.calculateMeanTimeToRecovery(deployments, windowConfig, incidents)

	dp := s.standardizeDeploymentFrequency(ctx, tenantID, deploymentFreq)
	lc := s.standardizeLeadTime(ctx, tenantID, leadTime, windowConfig)
	cfr := s.standardizeChangeFailureRate(ctx, tenantID, failureRate, windowConfig)
	mttrStd := s.standardizeMTTR(ctx, tenantID, mttr, windowConfig)

	return &models.AllDORAResult{
		DeploymentFrequency: dp,
		LeadTime:            lc,
		ChangeFailureRate:   cfr,
		MTTR:                mttrStd,
		ComputedAt:          time.Now().UTC(),
	}, nil
}

// GetDORATrend compares current and previous periods.
func (s *Service) GetDORATrend(ctx context.Context, tenantID string, deployments []models.DeploymentRecord, pipelines []models.PipelineCompletionRecord, incidents []models.IncidentRecord, timeWindow models.TimeWindow, windowSize int) (*models.DORATrendResult, error) {
	if windowSize <= 0 {
		windowSize = 1
	}

	current, err := s.GetAllDORA(ctx, tenantID, deployments, pipelines, incidents, timeWindow, windowSize)
	if err != nil {
		return nil, err
	}

	windowMs := getWindowDurationMs(timeWindow, windowSize)
	now := time.Now().UTC()
	previousEnd := now.Add(-windowMs)
	previousStart := now.Add(-2 * windowMs)

	prevDeployments := filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(previousStart) && d.DeployedAt.Before(previousEnd)
	})
	prevPipelines := filterSlice(pipelines, func(p models.PipelineCompletionRecord) bool {
		return !p.CompletedAt.Before(previousStart) && p.CompletedAt.Before(previousEnd)
	})
	prevIncidents := filterSlice(incidents, func(i models.IncidentRecord) bool {
		return !i.DetectedAt.Before(previousStart) && i.DetectedAt.Before(previousEnd)
	})

	previous, err := s.GetAllDORA(ctx, tenantID, prevDeployments, prevPipelines, prevIncidents, timeWindow, windowSize)
	if err != nil {
		return nil, err
	}

	currentPeriod := fmt.Sprintf("last %d %s(s)", windowSize, string(timeWindow))
	previousPeriod := fmt.Sprintf("%d %s(s) before that", windowSize, string(timeWindow))

	return &models.DORATrendResult{
		Current:  *current,
		Previous: *previous,
		Changes: models.DORATrendChanges{
			DeploymentFrequency: s.computeChangePercent(current.DeploymentFrequency.Value, previous.DeploymentFrequency.Value),
			LeadTime:            s.computeChangePercent(current.LeadTime.Value, previous.LeadTime.Value),
			ChangeFailureRate:   s.computeChangePercent(current.ChangeFailureRate.Value, previous.ChangeFailureRate.Value),
			MTTR:                s.computeChangePercent(current.MTTR.Value, previous.MTTR.Value),
		},
		CurrentPeriod:  currentPeriod,
		PreviousPeriod: previousPeriod,
	}, nil
}

// GetHistoricalSnapshots returns weekly aggregated data points.
func (s *Service) GetHistoricalSnapshots(ctx context.Context, tenantID string, weeks int) ([]models.HistoricalSnapshotWeek, error) {
	if weeks <= 0 {
		weeks = 12
	}

	var history []models.MetricSnapshot
	if s.repo != nil {
		entities, err := s.repo.ListSnapshotsByTenant(ctx, tenantID, weeks*7)
		if err == nil && len(entities) > 0 {
			history = entities
		}
	}

	// Sort descending by capturedAt
	sort.Slice(history, func(i, j int) bool {
		return history[i].CapturedAt.After(history[j].CapturedAt)
	})

	now := time.Now().UTC()
	result := make([]models.HistoricalSnapshotWeek, 0, weeks)
	for i := weeks - 1; i >= 0; i-- {
		weekStart := now.AddDate(0, 0, -i*7)
		weekStart = time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, time.UTC)
		weekEnd := weekStart.Add(7 * 24 * time.Hour)
		weekLabel := fmt.Sprintf("%d/%d", weekStart.Month(), weekStart.Day())

		var weekSnapshot *models.MetricSnapshot
		for _, snap := range history {
			if !snap.CapturedAt.Before(weekStart) && snap.CapturedAt.Before(weekEnd) {
				weekSnapshot = &snap
				break
			}
		}

		if weekSnapshot != nil {
			result = append(result, models.HistoricalSnapshotWeek{
				Week:                weekLabel,
				DeploymentFrequency: weekSnapshot.DeploymentFrequency,
				LeadTime:            int(math.Round(float64(weekSnapshot.LeadTimeMs) / 3_600_000)),
				MTTR:                int(math.Round(float64(weekSnapshot.MTTRMs) / 60_000)),
				ChangeFailureRate:   weekSnapshot.ChangeFailureRate,
			})
		} else {
			result = append(result, models.HistoricalSnapshotWeek{
				Week: weekLabel,
			})
		}
	}

	return result, nil
}

// GetBottlenecks derives bottleneck analysis from the latest report.
func (s *Service) GetBottlenecks(_context context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) []models.Bottleneck {
	report, _ := s.GenerateReport(_context, tenantID, timeWindow, windowSize)

	var bottlenecks []models.Bottleneck
	idx := 1

	dora := report.DoraMetrics
	if dora != nil {
		freq := dora.DeploymentFrequency.DeploymentsPerDay
		if freq < 1 {
			bottlenecks = append(bottlenecks, models.Bottleneck{
				ID:           fmt.Sprintf("bn-%03d", idx),
				Category:     "部署频率",
				Description:  fmt.Sprintf("发布频率较低，当前 %.2f 次/天，建议提升到每天至少 1 次", freq),
				Impact:       models.ImpactHigh,
				Metric:       "deployments per day",
				CurrentValue: fmt.Sprintf("%.2f", freq),
				TargetValue:  ">= 1",
				Suggestion:   "实施自动化部署流水线，减少手动审批环节",
			})
			idx++
		} else if freq < 3 {
			bottlenecks = append(bottlenecks, models.Bottleneck{
				ID:           fmt.Sprintf("bn-%03d", idx),
				Category:     "部署频率",
				Description:  fmt.Sprintf("发布频率中等，当前 %.2f 次/天，Elite 级别为每天多次", freq),
				Impact:       models.ImpactMedium,
				Metric:       "deployments per day",
				CurrentValue: fmt.Sprintf("%.2f", freq),
				TargetValue:  ">= 3",
				Suggestion:   "增加部署自动化程度，缩短部署周期",
			})
			idx++
		}

		leadHours := 0
		if dora.LeadTimeForChanges.AverageLeadTimeMs > 0 {
			leadHours = int(math.Round(float64(dora.LeadTimeForChanges.AverageLeadTimeMs) / 3_600_000))
		}
		if leadHours > 24 {
			impact := models.ImpactMedium
			if leadHours > 168 {
				impact = models.ImpactHigh
			}
			bottlenecks = append(bottlenecks, models.Bottleneck{
				ID:           fmt.Sprintf("bn-%03d", idx),
				Category:     "变更前置时间",
				Description:  fmt.Sprintf("变更前置时间较长，平均 %d 小时，建议缩短至 24 小时以内", leadHours),
				Impact:       impact,
				Metric:       "lead time (hours)",
				CurrentValue: fmt.Sprintf("%dh", leadHours),
				TargetValue:  "< 24h",
				Suggestion:   "采用小批量提交，减少代码合并冲突，实施持续集成",
			})
			idx++
		}

		failureRate := dora.ChangeFailureRate.FailureRate
		if failureRate > 5 {
			impact := models.ImpactMedium
			if failureRate > 15 {
				impact = models.ImpactHigh
			}
			bottlenecks = append(bottlenecks, models.Bottleneck{
				ID:           fmt.Sprintf("bn-%03d", idx),
				Category:     "变更失败率",
				Description:  fmt.Sprintf("变更失败率偏高 %.1f%%，建议控制在 5%% 以内", failureRate),
				Impact:       impact,
				Metric:       "change failure rate",
				CurrentValue: fmt.Sprintf("%.1f%%", failureRate),
				TargetValue:  "< 5%%",
				Suggestion:   "加强代码评审，增加自动化测试覆盖，实施渐进式发布",
			})
			idx++
		}

		mttrHours := 0
		if dora.MeanTimeToRecovery.AverageRecoveryTimeMs > 0 {
			mttrHours = int(math.Round(float64(dora.MeanTimeToRecovery.AverageRecoveryTimeMs) / 3_600_000))
		}
		if mttrHours > 1 {
			impact := models.ImpactMedium
			if mttrHours > 24 {
				impact = models.ImpactHigh
			}
			bottlenecks = append(bottlenecks, models.Bottleneck{
				ID:           fmt.Sprintf("bn-%03d", idx),
				Category:     "服务恢复时间",
				Description:  fmt.Sprintf("平均恢复时间 %d 小时，建议控制在 1 小时以内", mttrHours),
				Impact:       impact,
				Metric:       "MTTR (hours)",
				CurrentValue: fmt.Sprintf("%dh", mttrHours),
				TargetValue:  "< 1h",
				Suggestion:   "建立自动化故障检测和回滚机制，完善应急预案",
			})
			idx++
		}
	}

	if len(bottlenecks) == 0 {
		bottlenecks = append(bottlenecks, models.Bottleneck{
			ID:           "bn-ok",
			Category:     "整体健康",
			Description:  "当前 DORA 指标表现良好，无明显瓶颈",
			Impact:       models.ImpactLow,
			Metric:       "overall health",
			CurrentValue: "healthy",
			TargetValue:  "elite",
			Suggestion:   "继续保持当前实践，关注持续改进机会",
		})
	}

	return bottlenecks
}

// ==================== Private helpers ====================

func (s *Service) buildTimeWindow(window models.TimeWindow, size int) models.TimeWindowConfig {
	now := time.Now().UTC()
	var start time.Time
	switch window {
	case models.TimeWindowDay:
		start = now.AddDate(0, 0, -size)
	case models.TimeWindowWeek:
		start = now.AddDate(0, 0, -size*7)
	case models.TimeWindowMonth:
		start = now.AddDate(0, -size, 0)
	case models.TimeWindowQuarter:
		start = now.AddDate(0, -size*3, 0)
	default:
		start = now.AddDate(0, 0, -7)
	}
	return models.TimeWindowConfig{
		Window: window,
		Size:   size,
		Start:  start,
		End:    now,
	}
}

func (s *Service) calculateDoraReport(tenantID string, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord, wc models.TimeWindowConfig) *models.DoraMetricsReport {
	df := s.calculateDeploymentFrequency(deployments, wc)
	lc := s.calculateLeadTimeForChanges(pipelines, wc, deployments)
	cfr := s.calculateChangeFailureRate(deployments, wc)
	mttr := s.calculateMeanTimeToRecovery(deployments, wc, nil)
	overall := s.calculateOverallLevel(df.FrequencyLevel, lc.LeadTimeLevel, cfr.FailureRateLevel, mttr.RecoveryTimeLevel)

	return &models.DoraMetricsReport{
		ReportID:            uuid.New().String(),
		TenantID:            tenantID,
		Window:              wc,
		DeploymentFrequency: df,
		LeadTimeForChanges:  lc,
		ChangeFailureRate:   cfr,
		MeanTimeToRecovery:  mttr,
		OverallLevel:        overall,
		GeneratedAt:         time.Now().UTC(),
	}
}

func (s *Service) calculateDeploymentFrequency(deployments []models.DeploymentRecord, wc models.TimeWindowConfig) models.DeploymentFrequency {
	windowDepls := filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
	})
	successful := countBy(windowDepls, func(d models.DeploymentRecord) bool { return d.Status == "success" })
	failed := countBy(windowDepls, func(d models.DeploymentRecord) bool { return d.Status == "failed" })
	daysInWindow := daysInWindow(wc)
	perDay := 0.0
	if daysInWindow > 0 {
		perDay = float64(len(windowDepls)) / float64(daysInWindow)
	}
	return models.DeploymentFrequency{
		Window:                wc,
		TotalDeployments:      len(windowDepls),
		SuccessfulDeployments: successful,
		FailedDeployments:     failed,
		DeploymentsPerDay:     round2(perDay),
		FrequencyLevel:        s.evaluateDeploymentFrequency(perDay),
	}
}

func (s *Service) calculateLeadTimeForChanges(pipelines []models.PipelineCompletionRecord, wc models.TimeWindowConfig, deployments []models.DeploymentRecord) models.LeadTimeForChanges {
	// Prefer real commit→deploy chain
	if len(deployments) > 0 {
		valid := filterSlice(deployments, func(d models.DeploymentRecord) bool {
			return d.Status == "success" && d.CommitCommittedAt != nil &&
				!d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
		})
		if len(valid) > 0 {
			leadTimes := make([]int64, 0, len(valid))
			for _, d := range valid {
				leadTimes = append(leadTimes, d.DeployedAt.Sub(*d.CommitCommittedAt).Milliseconds())
			}
			return s.buildLeadTimeFromValues(leadTimes, wc, "commit_to_deploy")
		}
	}

	// Fallback: pipeline duration
	windowRecords := filterSlice(pipelines, func(p models.PipelineCompletionRecord) bool {
		return p.Status == "success" && !p.CompletedAt.Before(wc.Start) && !p.CompletedAt.After(wc.End)
	})
	leadTimes := make([]int64, 0, len(windowRecords))
	for _, p := range windowRecords {
		leadTimes = append(leadTimes, p.DurationMs)
	}
	if len(leadTimes) == 0 {
		return models.LeadTimeForChanges{
			Window:            wc,
			LeadTimeLevel:     models.LevelLow,
			CalculationMethod: "pipeline_duration",
		}
	}
	return s.buildLeadTimeFromValues(leadTimes, wc, "pipeline_duration")
}

func (s *Service) calculateChangeFailureRate(deployments []models.DeploymentRecord, wc models.TimeWindowConfig) models.ChangeFailureRate {
	windowDepls := filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
	})
	failed := filterSlice(windowDepls, func(d models.DeploymentRecord) bool {
		return d.Status == "failed" || d.Status == "rolled_back"
	})
	rate := 0.0
	if len(windowDepls) > 0 {
		rate = float64(len(failed)) / float64(len(windowDepls)) * 100
	}
	details := make([]models.DeploymentFailureRecord, 0, len(failed))
	for _, d := range failed {
		details = append(details, models.DeploymentFailureRecord{
			DeploymentID:   d.DeploymentID,
			Service:        d.Service,
			Environment:    d.Environment,
			FailedAt:       d.DeployedAt,
			RecoveryTimeMs: d.RecoveryTimeMs,
		})
	}
	return models.ChangeFailureRate{
		Window:            wc,
		TotalDeployments:  len(windowDepls),
		FailedDeployments: len(failed),
		FailureRate:       round2(rate),
		FailureRateLevel:  s.evaluateFailureRate(rate),
		FailureDetails:    details,
	}
}

func (s *Service) calculateMeanTimeToRecovery(deployments []models.DeploymentRecord, wc models.TimeWindowConfig, incidents []models.IncidentRecord) models.MeanTimeToRecovery {
	if len(incidents) > 0 {
		resolved := filterSlice(incidents, func(i models.IncidentRecord) bool {
			return i.Status == "resolved" && i.RecoveryTimeMs != nil &&
				!i.DetectedAt.Before(wc.Start) && !i.DetectedAt.After(wc.End)
		})
		if len(resolved) > 0 {
			times := make([]int64, 0, len(resolved))
			for _, i := range resolved {
				times = append(times, *i.RecoveryTimeMs)
			}
			totalIncidents := countBy(incidents, func(i models.IncidentRecord) bool {
				return !i.DetectedAt.Before(wc.Start) && !i.DetectedAt.After(wc.End)
			})
			return s.buildMTTRFromValues(times, totalIncidents, len(resolved), wc, "incidents_table")
		}
	}

	windowIncidents := filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return (d.Status == "failed" || d.Status == "rolled_back") &&
			!d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
	})
	recovered := filterSlice(windowIncidents, func(d models.DeploymentRecord) bool { return d.RecoveryTimeMs != nil })
	if len(windowIncidents) == 0 {
		return models.MeanTimeToRecovery{
			Window:            wc,
			RecoveryTimeLevel: models.LevelLow,
			CalculationMethod: "deployment_recovery",
		}
	}
	times := make([]int64, 0, len(recovered))
	for _, d := range recovered {
		times = append(times, *d.RecoveryTimeMs)
	}
	return s.buildMTTRFromValues(times, len(windowIncidents), len(recovered), wc, "deployment_recovery")
}

func (s *Service) buildLeadTimeFromValues(leadTimes []int64, wc models.TimeWindowConfig, method string) models.LeadTimeForChanges {
	sort.Slice(leadTimes, func(i, j int) bool { return leadTimes[i] < leadTimes[j] })
	avg := sumInt64(leadTimes) / int64(len(leadTimes))
	return models.LeadTimeForChanges{
		Window:            wc,
		TotalChanges:      len(leadTimes),
		AverageLeadTimeMs: avg,
		MedianLeadTimeMs:  percentile(leadTimes, 50),
		P90LeadTimeMs:     percentile(leadTimes, 90),
		P99LeadTimeMs:     percentile(leadTimes, 99),
		LeadTimeLevel:     s.evaluateLeadTime(avg),
		CalculationMethod: method,
	}
}

func (s *Service) buildMTTRFromValues(times []int64, total, recovered int, wc models.TimeWindowConfig, method string) models.MeanTimeToRecovery {
	if len(times) == 0 {
		return models.MeanTimeToRecovery{
			Window:             wc,
			TotalIncidents:     total,
			RecoveredIncidents: 0,
			RecoveryTimeLevel:  models.LevelLow,
			CalculationMethod:  method,
		}
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })
	avg := sumInt64(times) / int64(len(times))
	return models.MeanTimeToRecovery{
		Window:                wc,
		TotalIncidents:        total,
		RecoveredIncidents:    recovered,
		AverageRecoveryTimeMs: avg,
		MedianRecoveryTimeMs:  percentile(times, 50),
		P90RecoveryTimeMs:     percentile(times, 90),
		RecoveryTimeLevel:     s.evaluateRecoveryTime(avg),
		CalculationMethod:     method,
	}
}

func (s *Service) evaluateDeploymentFrequency(perDay float64) models.Level {
	if perDay >= doraThresholds.deploymentFrequency.onDemand {
		return models.FrequencyLevelOnDemand
	}
	if perDay >= doraThresholds.deploymentFrequency.daily {
		return models.FrequencyLevelDaily
	}
	if perDay >= doraThresholds.deploymentFrequency.weekly {
		return models.FrequencyLevelWeekly
	}
	if perDay >= doraThresholds.deploymentFrequency.monthly {
		return models.FrequencyLevelMonthly
	}
	return models.FrequencyLevelYearly
}

func (s *Service) evaluateLeadTime(ms int64) models.Level {
	if ms < doraThresholds.leadTimeMs.elite {
		return models.LevelElite
	}
	if ms < doraThresholds.leadTimeMs.high {
		return models.LevelHigh
	}
	if ms < doraThresholds.leadTimeMs.medium {
		return models.LevelMedium
	}
	return models.LevelLow
}

func (s *Service) evaluateFailureRate(rate float64) models.Level {
	if rate <= doraThresholds.failureRate.elite {
		return models.LevelElite
	}
	if rate <= doraThresholds.failureRate.high {
		return models.LevelHigh
	}
	if rate <= doraThresholds.failureRate.medium {
		return models.LevelMedium
	}
	return models.LevelLow
}

func (s *Service) evaluateRecoveryTime(ms int64) models.Level {
	if ms < doraThresholds.recoveryTimeMs.elite {
		return models.LevelElite
	}
	if ms < doraThresholds.recoveryTimeMs.high {
		return models.LevelHigh
	}
	if ms < doraThresholds.recoveryTimeMs.medium {
		return models.LevelMedium
	}
	return models.LevelLow
}

func (s *Service) calculateOverallLevel(freq, lead, fail, recovery models.Level) models.Level {
	freqMap := map[models.Level]int{
		models.LevelElite: 4, models.FrequencyLevelOnDemand: 4,
		models.LevelHigh: 3, models.FrequencyLevelDaily: 3,
		models.LevelMedium: 2, models.FrequencyLevelWeekly: 2,
		models.LevelLow: 1, models.FrequencyLevelMonthly: 1,
		models.FrequencyLevelYearly: 0,
	}
	values := []int{freqMap[freq], freqMap[lead], freqMap[fail], freqMap[recovery]}
	minV := values[0]
	for _, v := range values[1:] {
		if v < minV {
			minV = v
		}
	}
	reverseMap := map[int]models.Level{4: models.LevelElite, 3: models.LevelHigh, 2: models.LevelMedium, 1: models.LevelLow, 0: models.LevelLow}
	return reverseMap[minV]
}

