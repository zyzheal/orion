package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateGlobalDeployment(ctx context.Context, d *models.GlobalDeployment) error
	CreateGlobalPipeline(ctx context.Context, p *models.GlobalPipeline) error
	CreateProjectData(ctx context.Context, p *models.ProjectData) error
	CreateReportHistory(ctx context.Context, entry *models.ReportHistoryEntry) error
	CreateSnapshot(ctx context.Context, s *models.MetricSnapshot) error
	CreateTeamData(ctx context.Context, t *models.TeamData) error
	DeleteGlobalDeploymentsByTenant(ctx context.Context, tenantID string) error
	DeleteGlobalPipelinesByTenant(ctx context.Context, tenantID string) error
	ListGlobalDeployments(ctx context.Context, tenantID string) ([]models.GlobalDeployment, error)
	ListGlobalPipelines(ctx context.Context, tenantID string) ([]models.GlobalPipeline, error)
	ListProjectData(ctx context.Context, tenantID string) ([]models.ProjectData, error)
	ListReportHistory(ctx context.Context, tenantID string, limit int) ([]models.ReportHistoryEntry, error)
	ListSnapshotsByTenant(ctx context.Context, tenantID string, limit int) ([]models.MetricSnapshot, error)
	ListTeamData(ctx context.Context, tenantID string) ([]models.TeamData, error)
	PruneOldSnapshots(ctx context.Context, tenantID string, keep int) error
}

var (
	ErrNotFound   = errors.New("record not found")
	ErrBadRequest = errors.New("bad request")
	ErrLocked     = errors.New("locked")
)

func IsNotFound(err error) bool   { return errors.Is(err, ErrNotFound) }
func IsBadRequest(err error) bool { return errors.Is(err, ErrBadRequest) }
func IsLocked(err error) bool     { return errors.Is(err, ErrLocked) }

// defaultTargetHours defines the DORA targets used by DORACalculator.
const (
	targetDeploymentsPerDay = 3.0  // >= 3 deploys/day
	targetLeadTimeHours     = 24.0 // < 24 hours
	targetChangeFailureRate = 5.0  // < 5%
	targetMTTRHours         = 1.0  // < 1 hour
)

// doraThresholds matches the TS DORA_THRESHOLDS.
var doraThresholds = struct {
	deploymentFrequency struct {
		onDemand float64
		daily    float64
		weekly   float64
		monthly  float64
	}
	leadTimeMs struct {
		elite  int64
		high   int64
		medium int64
	}
	failureRate struct {
		elite  float64
		high   float64
		medium float64
	}
	recoveryTimeMs struct {
		elite  int64
		high   int64
		medium int64
	}
}{
	deploymentFrequency: struct {
		onDemand float64
		daily    float64
		weekly   float64
		monthly  float64
	}{
		onDemand: 1.0,
		daily:    1.0 / 7,
		weekly:   1.0 / 30,
		monthly:  1.0 / 180,
	},
	leadTimeMs: struct {
		elite  int64
		high   int64
		medium int64
	}{
		elite:  3_600_000,
		high:   86_400_000,
		medium: 604_800_000,
	},
	failureRate: struct {
		elite  float64
		high   float64
		medium float64
	}{
		elite:  5,
		high:   10,
		medium: 15,
	},
	recoveryTimeMs: struct {
		elite  int64
		high   int64
		medium int64
	}{
		elite:  3_600_000,
		high:   86_400_000,
		medium: 604_800_000,
	},
}

// defaultTeams is returned when no teams are registered (matches TS default set).
var defaultTeams = []models.TeamInfo{
	{TeamID: "platform", TeamName: "平台组"},
	{TeamID: "frontend", TeamName: "前端组"},
	{TeamID: "backend", TeamName: "后端组"},
	{TeamID: "qa", TeamName: "QA组"},
	{TeamID: "sre", TeamName: "SRE组"},
	{TeamID: "ai", TeamName: "AI组"},
}

// defaultRoles and defaultSpecialties for developer profile generation.
var defaultRoles = []string{
	"高级工程师", "中级工程师", "初级工程师", "SRE 工程师", "测试工程师", "ML 工程师",
}

var defaultSpecialties = [][]string{
	{"React", "TypeScript", "微前端"},
	{"Go", "gRPC", "K8s"},
	{"CI/CD", "Terraform", "Platform"},
	{"自动化测试", "性能测试", "Selenium"},
	{"Prometheus", "Grafana", "Incident"},
	{"Python", "TensorFlow", "MLOps"},
	{"Java", "Spring", "MySQL"},
	{"Rust", "WebAssembly", "Networking"},
}

// Service holds the efficiency business logic.
type Service struct {
	repo RepositoryInterface

	// In-memory caches (fallback / warm data). These are loaded at init and
	// used for metrics calculation just like the TS source's Map storage.
	mu sync.RWMutex

	// teamData[tenantID][teamID] -> team payload
	teamData map[string]map[string]*teamPayload
	// projectData[tenantID][projectID] -> project payload
	projectData map[string]map[string]*projectPayload
	// reportHistory[tenantID] -> list of reports (oldest first)
	reportHistory map[string][]*models.EfficiencyReport
	// globalDeployments[tenantID] -> deployment records
	globalDeployments map[string][]models.DeploymentRecord
	// globalPipelines[tenantID] -> pipeline records
	globalPipelines map[string][]models.PipelineCompletionRecord
}

type teamPayload struct {
	Name        string
	Members     int
	Pipelines   []models.PipelineCompletionRecord
	Deployments []models.DeploymentRecord
}

type projectPayload struct {
	Name        string
	Pipelines   []models.PipelineCompletionRecord
	Deployments []models.DeploymentRecord
	Commits     int
}

func NewService(repo RepositoryInterface) *Service {
	s := &Service{
		repo:              repo,
		teamData:          make(map[string]map[string]*teamPayload),
		projectData:       make(map[string]map[string]*projectPayload),
		reportHistory:     make(map[string][]*models.EfficiencyReport),
		globalDeployments: make(map[string][]models.DeploymentRecord),
		globalPipelines:   make(map[string][]models.PipelineCompletionRecord),
	}
	if repo != nil {
		_ = s.loadAllFromRepo(context.Background())
	}
	return s
}

// ==================== Report Generation ====================

// GenerateReport produces an efficiency report for the given tenant and window.
func (s *Service) GenerateReport(ctx context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) (*models.EfficiencyReport, error) {
	if windowSize <= 0 {
		windowSize = 1
	}
	windowConfig := s.buildTimeWindow(timeWindow, windowSize)

	deployments, pipelineRecords := s.getCachedData(tenantID)

	var doraMetrics *models.DoraMetricsReport
	if len(deployments) > 0 || len(pipelineRecords) > 0 {
		doraMetrics = s.calculateDoraReport(tenantID, pipelineRecords, deployments, windowConfig)
	}

	// Pipeline metrics within window
	windowPipelines := filterPipelinesByWindow(pipelineRecords, windowConfig)
	successfulPipelines := countBy(windowPipelines, func(p models.PipelineCompletionRecord) bool { return p.Status == "success" })
	successRate := 0.0
	var avgBuildMs int64
	if len(windowPipelines) > 0 {
		successRate = float64(successfulPipelines) / float64(len(windowPipelines)) * 100
		total := int64(0)
		for _, p := range windowPipelines {
			total += p.DurationMs
		}
		avgBuildMs = total / int64(len(windowPipelines))
	}

	windowDeployments := filterDeploymentsByWindow(deployments, windowConfig)

	report := &models.EfficiencyReport{
		ReportID:            uuid.New().String(),
		TenantID:            tenantID,
		TimeWindow:          timeWindow,
		WindowSize:          windowSize,
		DoraMetrics:         doraMetrics,
		TotalPipelineRuns:   len(windowPipelines),
		PipelineSuccessRate: round2(successRate),
		AverageBuildTimeMs:  avgBuildMs,
		TotalDeployments:    len(windowDeployments),
		GeneratedAt:         time.Now().UTC(),
	}

	s.saveReportHistory(tenantID, report)
	s.persistReportHistoryAsync(ctx, tenantID, report)

	return report, nil
}

// GetReportHistory returns the most recent reports for a tenant.
func (s *Service) GetReportHistory(ctx context.Context, tenantID string, limit int) ([]*models.EfficiencyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	history := s.reportHistory[tenantID]
	if limit <= 0 {
		limit = 10
	}
	if len(history) > limit {
		history = history[len(history)-limit:]
	}
	// Return a copy
	out := make([]*models.EfficiencyReport, len(history))
	copy(out, history)
	return out, nil
}

// ==================== Team / Project Metrics ====================

// GetTeamMetrics returns metrics for a single team.
func (s *Service) GetTeamMetrics(_context context.Context, tenantID, teamID string) (*models.TeamMetrics, error) {
	s.mu.RLock()
	payload := s.getTeamPayload(tenantID, teamID)
	s.mu.RUnlock()

	if payload == nil {
		return &models.TeamMetrics{
			TeamID:   teamID,
			TeamName: fmt.Sprintf("Team %s", teamID),
			TenantID: tenantID,
		}, nil
	}

	completed := len(payload.Pipelines)
	successful := countBy(payload.Pipelines, func(p models.PipelineCompletionRecord) bool { return p.Status == "success" })
	successRate := 0.0
	var avgTimeMs int64
	if completed > 0 {
		successRate = float64(successful) / float64(completed) * 100
		total := int64(0)
		for _, p := range payload.Pipelines {
			total += p.DurationMs
		}
		avgTimeMs = total / int64(completed)
	}

	failedDeploys := countBy(payload.Deployments, func(d models.DeploymentRecord) bool {
		return d.Status == "failed" || d.Status == "rolled_back"
	})
	cfr := 0.0
	if len(payload.Deployments) > 0 {
		cfr = float64(failedDeploys) / float64(len(payload.Deployments)) * 100
	}

	return &models.TeamMetrics{
		TeamID:                 teamID,
		TeamName:               payload.Name,
		TenantID:               tenantID,
		ActiveMembers:          payload.Members,
		CompletedPipelines:     completed,
		SuccessRate:            round2(successRate),
		AverageExecutionTimeMs: avgTimeMs,
		DeploymentCount:        len(payload.Deployments),
		ChangeFailureRate:      round2(cfr),
	}, nil
}

// GetProjectMetrics returns metrics for a single project.
func (s *Service) GetProjectMetrics(_context context.Context, tenantID, projectID string) (*models.ProjectMetrics, error) {
	s.mu.RLock()
	payload := s.getProjectPayload(tenantID, projectID)
	s.mu.RUnlock()

	if payload == nil {
		return &models.ProjectMetrics{
			ProjectID:   projectID,
			ProjectName: fmt.Sprintf("Project %s", projectID),
			TenantID:    tenantID,
		}, nil
	}

	total := len(payload.Pipelines)
	successful := countBy(payload.Pipelines, func(p models.PipelineCompletionRecord) bool { return p.Status == "success" })
	successRate := 0.0
	var avgBuildMs int64
	if total > 0 {
		successRate = float64(successful) / float64(total) * 100
		totalMs := int64(0)
		for _, p := range payload.Pipelines {
			totalMs += p.DurationMs
		}
		avgBuildMs = totalMs / int64(total)
	}

	sevenDaysAgo := time.Now().UTC().Add(-7 * 24 * time.Hour)
	recentCount := countBy(payload.Pipelines, func(p models.PipelineCompletionRecord) bool {
		return p.CompletedAt.After(sevenDaysAgo)
	})

	return &models.ProjectMetrics{
		ProjectID:           projectID,
		ProjectName:         payload.Name,
		TenantID:            tenantID,
		TotalPipelines:      total,
		RecentPipelineCount: recentCount,
		SuccessRate:         round2(successRate),
		AverageBuildTimeMs:  avgBuildMs,
		DeploymentCount:     len(payload.Deployments),
		CommitCount:         payload.Commits,
	}, nil
}

// GetAllTeams returns all registered teams (or defaults).
func (s *Service) GetAllTeams(_context context.Context, tenantID string) []models.TeamInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	teams := s.teamData[tenantID]
	if len(teams) == 0 {
		return copyTeamInfos(defaultTeams)
	}
	out := make([]models.TeamInfo, 0, len(teams))
	for id, p := range teams {
		out = append(out, models.TeamInfo{TeamID: id, TeamName: p.Name})
	}
	return out
}

// RegisterTeam injects team data (used by event handlers / tests).
func (s *Service) RegisterTeam(_context context.Context, tenantID, teamID, name string, members int, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.teamData[tenantID] == nil {
		s.teamData[tenantID] = make(map[string]*teamPayload)
	}
	s.teamData[tenantID][teamID] = &teamPayload{
		Name:        name,
		Members:     members,
		Pipelines:   pipelines,
		Deployments: deployments,
	}
	_ = s.persistTeamDataAsync(_context, tenantID, teamID, name, members, pipelines, deployments)
}

// RegisterProject injects project data.
func (s *Service) RegisterProject(_context context.Context, tenantID, projectID, name string, commits int, pipelines []models.PipelineCompletionRecord, deployments []models.DeploymentRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.projectData[tenantID] == nil {
		s.projectData[tenantID] = make(map[string]*projectPayload)
	}
	s.projectData[tenantID][projectID] = &projectPayload{
		Name:        name,
		Pipelines:   pipelines,
		Deployments: deployments,
		Commits:     commits,
	}
	_ = s.persistProjectDataAsync(_context, tenantID, projectID, name, pipelines, deployments, commits)
}

// InjectGlobalData sets the full deployment and pipeline data for a tenant.
func (s *Service) InjectGlobalData(_context context.Context, tenantID string, deployments []models.DeploymentRecord, pipelines []models.PipelineCompletionRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.globalDeployments[tenantID] = deployments
	s.globalPipelines[tenantID] = pipelines
	_ = s.persistGlobalDeploymentsAsync(_context, tenantID, deployments)
	_ = s.persistGlobalPipelinesAsync(_context, tenantID, pipelines)
}

// ==================== Period Comparison ====================

// ComparePeriods computes metrics for two time periods and the deltas.
func (s *Service) ComparePeriods(_context context.Context, tenantID string, periodA, periodB models.PeriodSpec) (*models.PeriodComparisonResult, error) {
	deployments, pipelineRecords := s.getCachedData(tenantID)

	metricsA := s.computePeriodMetrics(pipelineRecords, deployments, periodA.Start, periodB.End /* unused */, periodA)
	metricsB := s.computePeriodMetrics(pipelineRecords, deployments, periodB.Start, periodB.End, periodB)

	changes := models.PeriodChanges{
		PipelineRuns:      s.computeChangePercent(float64(metricsA.PipelineRuns), float64(metricsB.PipelineRuns)),
		SuccessRate:       s.computeChangePercent(metricsA.SuccessRate, metricsB.SuccessRate),
		AverageBuildTime:  s.computeChangePercent(float64(metricsA.AverageBuildTimeMs), float64(metricsB.AverageBuildTimeMs)),
		Deployments:       s.computeChangePercent(float64(metricsA.Deployments), float64(metricsB.Deployments)),
		ChangeFailureRate: s.computeChangePercent(metricsA.ChangeFailureRate, metricsB.ChangeFailureRate),
	}

	return &models.PeriodComparisonResult{
		PeriodA: metricsA,
		PeriodB: metricsB,
		Changes: changes,
	}, nil
}

// ==================== Developer Profiles ====================

// GetDeveloperProfiles derives developer profiles from team data.
func (s *Service) GetDeveloperProfiles(_context context.Context, tenantID string) []models.DeveloperProfile {
	s.mu.RLock()
	teams := s.teamData[tenantID]
	s.mu.RUnlock()

	profiles := []models.DeveloperProfile{}
	profileIndex := 0

	for teamID, p := range teams {
		completedPipelines := len(p.Pipelines)
		successfulPipelines := countBy(p.Pipelines, func(x models.PipelineCompletionRecord) bool { return x.Status == "success" })
		teamSuccessRate := 0.0
		if completedPipelines > 0 {
			teamSuccessRate = float64(successfulPipelines) / float64(completedPipelines) * 100
		}

		memberCount := p.Members
		if memberCount < 1 {
			memberCount = 1
		}
		maxMembers := memberCount
		if maxMembers > 3 {
			maxMembers = 3
		}
		for i := 0; i < maxMembers; i++ {
			profileID := fmt.Sprintf("dev-%s-%d", teamID, i+1)
			commits := completedPipelines*5 + 25 // deterministic midpoint
			prs := completedPipelines*8/10 + 5
			reviews := completedPipelines*12/10 + 10
			bugsFixed := successfulPipelines*3/10 + 2
			avgReviewTime := 10 + 12
			avgPRSize := 80 + 150
			codeQuality := int(math.Min(98, teamSuccessRate*0.7+20+7.5))
			activeDays := 15 + 3

			profiles = append(profiles, models.DeveloperProfile{
				ID:            profileID,
				Name:          fmt.Sprintf("%s成员%d", p.Name, i+1),
				Team:          p.Name,
				Role:          defaultRoles[profileIndex%len(defaultRoles)],
				Commits:       commits,
				PRs:           prs,
				Reviews:       reviews,
				BugsFixed:     bugsFixed,
				AvgReviewTime: avgReviewTime,
				AvgPRSize:     avgPRSize,
				CodeQuality:   codeQuality,
				ActiveDays:    activeDays,
				Specialty:     defaultSpecialties[profileIndex%len(defaultSpecialties)],
			})
			profileIndex++
		}
	}

	return profiles
}

// ==================== Dashboard / DORA ====================

// GetDashboardData returns the /dashboard aggregated response.
func (s *Service) GetDashboardData(_context context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) *models.DashboardData {
	report, _ := s.GenerateReport(_context, tenantID, timeWindow, windowSize)

	var dora models.DashboardDORA
	var summary models.DashboardSummary

	if report.DoraMetrics != nil {
		d := report.DoraMetrics
		leadHours := 0
		if d.LeadTimeForChanges.AverageLeadTimeMs > 0 {
			leadHours = int(math.Round(float64(d.LeadTimeForChanges.AverageLeadTimeMs) / 3_600_000))
		}
		mttrMin := 0
		if d.MeanTimeToRecovery.AverageRecoveryTimeMs > 0 {
			mttrMin = int(math.Round(float64(d.MeanTimeToRecovery.AverageRecoveryTimeMs) / 60_000))
		}
		dora = models.DashboardDORA{
			DeploymentFrequency: d.DeploymentFrequency.DeploymentsPerDay,
			LeadTime:            leadHours,
			MTTR:                mttrMin,
			ChangeFailureRate:   d.ChangeFailureRate.FailureRate,
		}
		summary = models.DashboardSummary{
			TotalDeployments:      report.TotalDeployments,
			SuccessfulDeployments: d.DeploymentFrequency.SuccessfulDeployments,
			FailedDeployments:     d.DeploymentFrequency.FailedDeployments,
		}
	}

	// Trends mirror DORA values for this response shape (TS equivalent)
	return &models.DashboardData{
		DORA:    dora,
		Trends:  dora,
		Summary: summary,
	}
}

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
		go func() {
			_ = s.repo.CreateSnapshot(ctx, &snapshot)
			_ = s.repo.PruneOldSnapshots(ctx, tenantID, 100)
		}()
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
	go func() {
		_ = s.repo.CreateReportHistory(ctx, &models.ReportHistoryEntry{
			TenantID:    tenantID,
			ReportData:  string(data),
			GeneratedAt: report.GeneratedAt,
		})
	}()
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
	go func() {
		_ = s.repo.CreateTeamData(ctx, &models.TeamData{
			ID: teamID, TenantID: tenantID, Name: name, Members: members,
			Pipelines: string(pdata), Deployments: string(ddata),
		})
	}()
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
	go func() {
		_ = s.repo.CreateProjectData(ctx, &models.ProjectData{
			ID: projectID, TenantID: tenantID, Name: name,
			Pipelines: string(pdata), Deployments: string(ddata), Commits: commits,
		})
	}()
	return nil
}

func (s *Service) persistGlobalDeploymentsAsync(ctx context.Context, tenantID string, deployments []models.DeploymentRecord) error {
	if s.repo == nil {
		return nil
	}
	go func() {
		_ = s.repo.DeleteGlobalDeploymentsByTenant(ctx, tenantID)
		for _, d := range deployments {
			data, _ := json.Marshal(d)
			_ = s.repo.CreateGlobalDeployment(ctx, &models.GlobalDeployment{
				TenantID: tenantID, DeploymentData: string(data), DeployedAt: d.DeployedAt,
			})
		}
	}()
	return nil
}

func (s *Service) persistGlobalPipelinesAsync(ctx context.Context, tenantID string, pipelines []models.PipelineCompletionRecord) error {
	if s.repo == nil {
		return nil
	}
	go func() {
		_ = s.repo.DeleteGlobalPipelinesByTenant(ctx, tenantID)
		for _, p := range pipelines {
			data, _ := json.Marshal(p)
			_ = s.repo.CreateGlobalPipeline(ctx, &models.GlobalPipeline{
				TenantID: tenantID, PipelineData: string(data), CompletedAt: p.CompletedAt,
			})
		}
	}()
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

// ==================== Generic helpers ====================

func filterSlice[T any](slice []T, fn func(T) bool) []T {
	out := make([]T, 0, len(slice))
	for _, v := range slice {
		if fn(v) {
			out = append(out, v)
		}
	}
	return out
}

func countBy[T any](slice []T, fn func(T) bool) int {
	n := 0
	for _, v := range slice {
		if fn(v) {
			n++
		}
	}
	return n
}

func filterPipelinesByWindow(pipelines []models.PipelineCompletionRecord, wc models.TimeWindowConfig) []models.PipelineCompletionRecord {
	return filterSlice(pipelines, func(p models.PipelineCompletionRecord) bool {
		return !p.CompletedAt.Before(wc.Start) && !p.CompletedAt.After(wc.End)
	})
}

func filterDeploymentsByWindow(deployments []models.DeploymentRecord, wc models.TimeWindowConfig) []models.DeploymentRecord {
	return filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
	})
}

func daysInWindow(wc models.TimeWindowConfig) int {
	msInDay := 24 * 60 * 60 * 1000
	days := int(wc.End.Sub(wc.Start).Milliseconds() / int64(msInDay))
	if days < 1 {
		return 1
	}
	return days
}

func getWindowDurationMs(window models.TimeWindow, size int) time.Duration {
	dayMs := int64(24 * 60 * 60 * 1000)
	switch window {
	case models.TimeWindowDay:
		return time.Duration(dayMs*int64(size)) * time.Millisecond
	case models.TimeWindowWeek:
		return time.Duration(dayMs*7*int64(size)) * time.Millisecond
	case models.TimeWindowMonth:
		return time.Duration(dayMs*30*int64(size)) * time.Millisecond
	case models.TimeWindowQuarter:
		return time.Duration(dayMs*90*int64(size)) * time.Millisecond
	default:
		return time.Duration(dayMs*7*int64(size)) * time.Millisecond
	}
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func sumInt64(vals []int64) int64 {
	var s int64
	for _, v := range vals {
		s += v
	}
	return s
}

func percentile(sorted []int64, p int) int64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(math.Ceil(float64(p)/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

func invertTrend(t models.Trend) models.Trend {
	switch t {
	case models.TrendUp:
		return models.TrendDown
	}
	return t
}

func copyTeamInfos(src []models.TeamInfo) []models.TeamInfo {
	out := make([]models.TeamInfo, len(src))
	copy(out, src)
	return out
}
