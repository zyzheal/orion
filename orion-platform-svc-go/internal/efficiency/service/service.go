package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"

	"orion/go-common/pkg/sentinel"

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
	ErrBadRequest = errors.New("bad request")
	ErrLocked     = errors.New("locked")
)

func IsNotFound(err error) bool   { return errors.Is(err, sentinel.NotFound) }
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
