package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"orion/platform-svc-go/internal/ci-cd/canary/models"
	"orion/platform-svc-go/internal/ci-cd/canary/repository"

	"github.com/google/uuid"
)

var (
	ErrCanaryNotFound  = errors.New("canary not found")
	ErrInvalidStatus   = errors.New("invalid status transition")
	ErrConfigNotFound  = errors.New("config not found")
	ErrRunNotFound     = errors.New("analysis run not found")
	ErrTrafficNotFound = errors.New("traffic config not found")
)

// CanaryService provides business logic for canary deployments, analysis, and traffic management.
type CanaryService struct {
	repo         *repository.CanaryRepository
	runRepo      *repository.CanaryAnalysisRunRepository
	metricRepo   *repository.CanaryMetricResultRepository
	mlRepo       *repository.CanaryMLResultRepository
	configRepo   *repository.CanaryAnalysisConfigRepository
	decisionRepo *repository.CanaryDecisionRepository
	retrainRepo  *repository.CanaryRetrainJobRepository
	trafficRepo  *repository.TrafficConfigRepository
	historyRepo  *repository.TrafficHistoryRepository
}

// NewCanaryService creates a new CanaryService with all repositories.
func NewCanaryService(
	repo *repository.CanaryRepository,
	runRepo *repository.CanaryAnalysisRunRepository,
	metricRepo *repository.CanaryMetricResultRepository,
	mlRepo *repository.CanaryMLResultRepository,
	configRepo *repository.CanaryAnalysisConfigRepository,
	decisionRepo *repository.CanaryDecisionRepository,
	retrainRepo *repository.CanaryRetrainJobRepository,
	trafficRepo *repository.TrafficConfigRepository,
	historyRepo *repository.TrafficHistoryRepository,
) *CanaryService {
	return &CanaryService{
		repo:         repo,
		runRepo:      runRepo,
		metricRepo:   metricRepo,
		mlRepo:       mlRepo,
		configRepo:   configRepo,
		decisionRepo: decisionRepo,
		retrainRepo:  retrainRepo,
		trafficRepo:  trafficRepo,
		historyRepo:  historyRepo,
	}
}

// ==================== Canary Deployment CRUD ====================

func (s *CanaryService) Create(ctx context.Context, c *models.Canary) error {
	if c.Status == "" {
		c.Status = models.CanaryPending
	}
	if c.Weight <= 0 {
		c.Weight = 10
	}
	if c.TargetWeight <= 0 {
		c.TargetWeight = 100
	}
	return s.repo.Create(ctx, c)
}

func (s *CanaryService) GetByID(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *CanaryService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Canary, error) {
	return s.repo.ListByTenant(ctx, tenantID, offset, limit)
}

func (s *CanaryService) ListByStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.Canary, error) {
	return s.repo.ListByTenantAndStatus(ctx, tenantID, status, offset, limit)
}

func (s *CanaryService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *CanaryService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

func (s *CanaryService) Promote(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	canary, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrCanaryNotFound
	}
	if canary.Status != models.CanaryRunning {
		return nil, ErrInvalidStatus
	}
	if err := s.repo.UpdateStatus(ctx, id, models.CanarySuccess); err != nil {
		return nil, err
	}
	canary.Status = models.CanarySuccess
	now := time.Now()
	canary.CompletedAt = &now
	return canary, nil
}

func (s *CanaryService) Rollback(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	canary, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrCanaryNotFound
	}
	if canary.Status != models.CanaryRunning {
		return nil, ErrInvalidStatus
	}
	if err := s.repo.UpdateStatus(ctx, id, models.CanaryRolled); err != nil {
		return nil, err
	}
	canary.Status = models.CanaryRolled
	now := time.Now()
	canary.CompletedAt = &now
	return canary, nil
}

func (s *CanaryService) AddMetric(ctx context.Context, m *models.CanaryMetric) error {
	return s.repo.AddMetric(ctx, m)
}

func (s *CanaryService) GetMetrics(ctx context.Context, canaryID string) ([]models.CanaryMetric, error) {
	return s.repo.GetMetrics(ctx, canaryID)
}

func (s *CanaryService) AddAnalysis(ctx context.Context, a *models.CanaryAnalysis) error {
	return s.repo.AddAnalysis(ctx, a)
}

func (s *CanaryService) GetAnalysis(ctx context.Context, canaryID string) ([]models.CanaryAnalysis, error) {
	return s.repo.GetAnalysis(ctx, canaryID)
}

// ==================== Analysis Runs ====================

func (s *CanaryService) ListRuns(ctx context.Context, deploymentID, status string) ([]models.CanaryAnalysisRun, error) {
	if deploymentID != "" {
		return s.runRepo.FindByDeployment(ctx, deploymentID)
	}
	if status != "" {
		return s.runRepo.FindByStatus(ctx, status)
	}
	return s.runRepo.FindAll(ctx, 100)
}

func (s *CanaryService) GetRunByID(ctx context.Context, id string) (*models.CanaryAnalysisRun, error) {
	return s.runRepo.FindByID(ctx, id)
}

// CreateAnalysisRun creates a new analysis run with simulation.
func (s *CanaryService) CreateAnalysisRun(ctx context.Context, deploymentID string, runNumber int, trafficSplit models.TrafficSplit) (*RunSummary, error) {
	input := &models.CanaryAnalysisRunCreateInput{
		DeploymentID: deploymentID,
		RunNumber:    runNumber,
		TrafficSplit: trafficSplit,
	}
	return s.SimulateAnalysisRun(ctx, input)
}

// RunSummary aggregates a run with its metrics and ML results.
type RunSummary struct {
	Run       models.CanaryAnalysisRun    `json:"run"`
	Metrics   []models.CanaryMetricResult `json:"metrics"`
	MLResults []models.CanaryMLResult     `json:"ml_results"`
}

// SimulateAnalysisRun creates a full simulated analysis run with generated metrics and ML results.
func (s *CanaryService) SimulateAnalysisRun(ctx context.Context, input *models.CanaryAnalysisRunCreateInput) (*RunSummary, error) {
	if input.RunNumber == 0 {
		input.RunNumber = 1
	}
	if input.TrafficSplit.Canary == 0 && input.TrafficSplit.Baseline == 0 {
		input.TrafficSplit = models.TrafficSplit{Canary: 10, Baseline: 90}
	}

	run := &models.CanaryAnalysisRun{
		ID:           uuid.New().String(),
		DeploymentID: input.DeploymentID,
		RunNumber:    input.RunNumber,
		TrafficSplit: input.TrafficSplit,
		Status:       models.AnalysisRunning,
		StartedAt:    time.Now(),
	}
	if err := s.runRepo.Create(ctx, run); err != nil {
		return nil, fmt.Errorf("failed to create analysis run: %w", err)
	}

	metrics, err := s.generateSimulatedMetrics(ctx, run.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate metrics: %w", err)
	}

	mlResults, err := s.generateSimulatedMLResults(ctx, run.ID, metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ML results: %w", err)
	}

	decision := calculateDecision(metrics, mlResults)
	confidence := calculateConfidence(metrics, mlResults)

	completedAt := time.Now()
	var status models.AnalysisStatus
	switch decision {
	case models.DecisionPromote:
		status = models.AnalysisPromote
	case models.DecisionRollback:
		status = models.AnalysisRollback
	default:
		status = models.AnalysisInconclusive
	}
	if err := s.runRepo.UpdateRunStatus(ctx, run.ID, status, decision, confidence, completedAt); err != nil {
		return nil, fmt.Errorf("failed to update run status: %w", err)
	}

	reason := getDecisionReason(metrics, mlResults)
	decisionRecord := &models.CanaryDecisionRecord{
		ID:        uuid.New().String(),
		RunID:     run.ID,
		Decision:  decision,
		Reason:    &reason,
		DecidedAt: time.Now(),
	}
	if err := s.decisionRepo.Create(ctx, decisionRecord); err != nil {
		return nil, fmt.Errorf("failed to record decision: %w", err)
	}

	run.Status = status
	run.Decision = &decision
	run.Confidence = &confidence
	run.CompletedAt = &completedAt
	durationMs := float64(completedAt.Sub(run.StartedAt).Milliseconds())
	run.DurationMs = &durationMs

	return &RunSummary{Run: *run, Metrics: metrics, MLResults: mlResults}, nil
}

// ==================== Metrics & ML Results ====================

func (s *CanaryService) GetMetricsForRun(ctx context.Context, runID string) ([]models.CanaryMetricResult, error) {
	return s.metricRepo.FindByRun(ctx, runID)
}

func (s *CanaryService) GetMLResults(ctx context.Context, runID string) ([]models.CanaryMLResult, error) {
	return s.mlRepo.FindByRun(ctx, runID)
}

// MetricsSummary provides aggregate statistics across all runs.
type MetricsSummary struct {
	TotalRuns         int     `json:"total_runs"`
	PromotedRuns      int     `json:"promoted_runs"`
	RolledBackRuns    int     `json:"rolled_back_runs"`
	InconclusiveRuns  int     `json:"inconclusive_runs"`
	AverageConfidence float64 `json:"average_confidence"`
	PassRate          float64 `json:"pass_rate"`
}

func (s *CanaryService) GetMetricsSummary(ctx context.Context) (*MetricsSummary, error) {
	runs, err := s.runRepo.FindAll(ctx, 1000)
	if err != nil {
		return &MetricsSummary{}, nil
	}
	if len(runs) == 0 {
		return &MetricsSummary{}, nil
	}

	var promoted, rolledBack, inconclusive int
	var confidenceSum float64
	for _, r := range runs {
		switch r.Status {
		case models.AnalysisPromote:
			promoted++
		case models.AnalysisRollback:
			rolledBack++
		case models.AnalysisInconclusive:
			inconclusive++
		}
		if r.Confidence != nil {
			confidenceSum += *r.Confidence
		}
	}

	avgConfidence := confidenceSum / float64(len(runs))
	completed := promoted + rolledBack
	passRate := 0.0
	if completed > 0 {
		passRate = float64(promoted) / float64(completed)
	}

	return &MetricsSummary{
		TotalRuns:         len(runs),
		PromotedRuns:      promoted,
		RolledBackRuns:    rolledBack,
		InconclusiveRuns:  inconclusive,
		AverageConfidence: avgConfidence,
		PassRate:          passRate,
	}, nil
}

// ==================== Analysis Configs ====================

func (s *CanaryService) ListConfigs(ctx context.Context) ([]models.CanaryAnalysisConfig, error) {
	return s.configRepo.FindAll(ctx)
}

func (s *CanaryService) CreateConfig(ctx context.Context, input *models.CanaryAnalysisConfigCreateInput) (*models.CanaryAnalysisConfig, error) {
	config := &models.CanaryAnalysisConfig{
		ID:              uuid.New().String(),
		ServiceName:     input.ServiceName,
		Environment:     input.Environment,
		ExcludedMetrics: models.StringArray(input.ExcludedMetrics),
		SloMetrics:      models.StringArray(input.SloMetrics),
		MetricWeights:   input.MetricWeights,
	}
	config.AnalysisIntervalSec = 300
	if input.AnalysisIntervalSec != nil {
		config.AnalysisIntervalSec = *input.AnalysisIntervalSec
	}
	config.MaxRounds = 5
	if input.MaxRounds != nil {
		config.MaxRounds = *input.MaxRounds
	}
	config.WarmupPeriodSec = 600
	if input.WarmupPeriodSec != nil {
		config.WarmupPeriodSec = *input.WarmupPeriodSec
	}
	config.PromoteThreshold = 0.75
	if input.PromoteThreshold != nil {
		config.PromoteThreshold = *input.PromoteThreshold
	}
	config.RollbackThreshold = 0.60
	if input.RollbackThreshold != nil {
		config.RollbackThreshold = *input.RollbackThreshold
	}
	config.TrafficStep = 20
	if input.TrafficStep != nil {
		config.TrafficStep = *input.TrafficStep
	}
	if err := s.configRepo.Create(ctx, config); err != nil {
		return nil, fmt.Errorf("failed to create config: %w", err)
	}
	return config, nil
}

func (s *CanaryService) GetConfigByServiceEnv(ctx context.Context, serviceName, environment string) (*models.CanaryAnalysisConfig, error) {
	return s.configRepo.FindByServiceEnv(ctx, serviceName, environment)
}

func (s *CanaryService) UpdateConfig(ctx context.Context, id string, updates *models.CanaryAnalysisConfigUpdateInput) (*models.CanaryAnalysisConfig, error) {
	existing, err := s.configRepo.FindByID(ctx, id)
	if err != nil || existing == nil {
		return nil, ErrConfigNotFound
	}
	return s.configRepo.UpdateConfig(ctx, id, updates)
}

func (s *CanaryService) DeleteConfig(ctx context.Context, id string) error {
	return s.configRepo.Delete(ctx, id)
}

// ==================== Force Actions ====================

func (s *CanaryService) ForcePromote(ctx context.Context, runID, reason string) (*models.CanaryAnalysisRun, error) {
	existing, err := s.runRepo.FindByID(ctx, runID)
	if err != nil {
		return nil, ErrRunNotFound
	}

	completedAt := time.Now()
	if err := s.runRepo.UpdateRunStatus(ctx, runID, models.AnalysisPromote, models.DecisionPromote, 1.0, completedAt); err != nil {
		return nil, fmt.Errorf("failed to force promote: %w", err)
	}

	overrideBy := "admin"
	fullReason := fmt.Sprintf("Force promote: %s", reason)
	decisionRecord := &models.CanaryDecisionRecord{
		ID:             uuid.New().String(),
		RunID:          runID,
		Decision:       models.DecisionPromote,
		Reason:         &fullReason,
		OverriddenBy:   &overrideBy,
		OverrideReason: &reason,
		DecidedAt:      time.Now(),
	}
	if err := s.decisionRepo.Create(ctx, decisionRecord); err != nil {
		return nil, fmt.Errorf("failed to record decision: %w", err)
	}

	existing.Status = models.AnalysisPromote
	decision := models.DecisionPromote
	existing.Decision = &decision
	c := 1.0
	existing.Confidence = &c
	existing.CompletedAt = &completedAt
	return existing, nil
}

func (s *CanaryService) ForceRollback(ctx context.Context, runID, reason string) (*models.CanaryAnalysisRun, error) {
	existing, err := s.runRepo.FindByID(ctx, runID)
	if err != nil {
		return nil, ErrRunNotFound
	}

	completedAt := time.Now()
	if err := s.runRepo.UpdateRunStatus(ctx, runID, models.AnalysisRollback, models.DecisionRollback, 0.0, completedAt); err != nil {
		return nil, fmt.Errorf("failed to force rollback: %w", err)
	}

	overrideBy := "admin"
	fullReason := fmt.Sprintf("Force rollback: %s", reason)
	decisionRecord := &models.CanaryDecisionRecord{
		ID:             uuid.New().String(),
		RunID:          runID,
		Decision:       models.DecisionRollback,
		Reason:         &fullReason,
		OverriddenBy:   &overrideBy,
		OverrideReason: &reason,
		DecidedAt:      time.Now(),
	}
	if err := s.decisionRepo.Create(ctx, decisionRecord); err != nil {
		return nil, fmt.Errorf("failed to record decision: %w", err)
	}

	existing.Status = models.AnalysisRollback
	decision := models.DecisionRollback
	existing.Decision = &decision
	c := 0.0
	existing.Confidence = &c
	existing.CompletedAt = &completedAt
	return existing, nil
}

// ==================== Discover & Retrain ====================

type MetricInfo struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

func (s *CanaryService) DiscoverMetrics() []MetricInfo {
	return []MetricInfo{
		{Name: "request_latency_p50", Category: "latency", Description: "P50 request latency (ms)"},
		{Name: "request_latency_p95", Category: "latency", Description: "P95 request latency (ms)"},
		{Name: "request_latency_p99", Category: "latency", Description: "P99 request latency (ms)"},
		{Name: "error_rate", Category: "error_rate", Description: "Error rate (errors per second)"},
		{Name: "5xx_rate", Category: "error_rate", Description: "5xx error rate"},
		{Name: "throughput", Category: "throughput", Description: "Requests per second"},
		{Name: "cpu_utilization", Category: "saturation", Description: "CPU utilization (%)"},
		{Name: "memory_utilization", Category: "saturation", Description: "Memory utilization (%)"},
	}
}

func (s *CanaryService) TriggerModelRetraining(ctx context.Context, modelName string) (*models.CanaryRetrainJob, error) {
	job := &models.CanaryRetrainJob{
		ID:        uuid.New().String(),
		ModelName: modelName,
		Status:    "queued",
	}
	if err := s.retrainRepo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create retrain job: %w", err)
	}
	return job, nil
}

func (s *CanaryService) ListRetrainJobs(ctx context.Context) ([]models.CanaryRetrainJob, error) {
	return s.retrainRepo.FindAll(ctx)
}

// ==================== Traffic Management ====================

func (s *CanaryService) SetTrafficRules(ctx context.Context, canaryID string, baselineWeight, canaryWeight int, strategy, host, namespace string) (*models.TrafficConfig, error) {
	if strategy == "" {
		strategy = "weighted"
	}
	if namespace == "" {
		namespace = "default"
	}
	configID := fmt.Sprintf("%s-config", canaryID)
	phase := determinePhase(canaryWeight)
	input := &models.TrafficConfigUpsertInput{
		ID:             configID,
		CanaryID:       canaryID,
		Strategy:       strategy,
		Phase:          &phase,
		BaselineWeight: &baselineWeight,
		CanaryWeight:   &canaryWeight,
		Namespace:      &namespace,
	}
	if host != "" {
		input.Host = &host
	}
	return s.trafficRepo.UpsertConfig(ctx, input)
}

func (s *CanaryService) GetTrafficConfig(ctx context.Context, canaryID string) (*models.TrafficConfig, error) {
	return s.trafficRepo.FindByCanaryID(ctx, canaryID)
}

func (s *CanaryService) GetAllTrafficConfigs(ctx context.Context) ([]models.TrafficConfig, error) {
	return s.trafficRepo.FindAll(ctx)
}

func (s *CanaryService) UpdateTraffic(ctx context.Context, canaryID string, updates *models.TrafficConfigUpdateInput) (*models.TrafficConfig, error) {
	current, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
	if err != nil || current == nil {
		return nil, ErrTrafficNotFound
	}
	return s.trafficRepo.Update(ctx, canaryID, updates)
}

func (s *CanaryService) DeleteTraffic(ctx context.Context, canaryID string) error {
	return s.trafficRepo.Delete(ctx, canaryID)
}

// TrafficSplitResult represents the result of a traffic split operation.
type TrafficSplitResult struct {
	Success  bool   `json:"success"`
	CanaryID string `json:"canary_id"`
	Result   string `json:"result"`
	Error    string `json:"error,omitempty"`
}

func (s *CanaryService) ConfigureIstioVirtualService(ctx context.Context, canaryID, host string, canaryPercent int) (*TrafficSplitResult, error) {
	if canaryPercent < 0 || canaryPercent > 100 {
		return &TrafficSplitResult{Success: false, CanaryID: canaryID, Error: "canaryPercent must be between 0 and 100"}, nil
	}

	baselinePercent := 100 - canaryPercent
	phase := determinePhase(canaryPercent)
	configID := fmt.Sprintf("%s-config", canaryID)
	baselineDest := fmt.Sprintf("%s-baseline", host)
	canaryDest := fmt.Sprintf("%s-canary", host)
	baselineSubset := "baseline"
	canarySubset := "canary"
	ns := "default"

	input := &models.TrafficConfigUpsertInput{
		ID: configID, CanaryID: canaryID, Strategy: "istio",
		Phase: &phase, Host: &host, Namespace: &ns,
		BaselineWeight: &baselinePercent, CanaryWeight: &canaryPercent,
		BaselineDestination: &baselineDest, BaselineSubset: &baselineSubset,
		CanaryDestination: &canaryDest, CanarySubset: &canarySubset,
	}
	if _, err := s.trafficRepo.UpsertConfig(ctx, input); err != nil {
		return nil, fmt.Errorf("failed to save traffic config: %w", err)
	}

	resultMsg := fmt.Sprintf("Istio VirtualService applied: baseline=%d%%, canary=%d%% for %s", baselinePercent, canaryPercent, host)
	historyID := fmt.Sprintf("%s-%d", canaryID, time.Now().UnixMilli())
	_, _ = s.historyRepo.CreateEntry(ctx, &models.TrafficHistoryCreateInput{
		ID: historyID, CanaryID: canaryID, Success: true, Result: resultMsg,
	})
	return &TrafficSplitResult{Success: true, CanaryID: canaryID, Result: resultMsg}, nil
}

func (s *CanaryService) ConfigureNGINXWeight(ctx context.Context, canaryID, upstream string, weight int) (*TrafficSplitResult, error) {
	if weight < 0 || weight > 100 {
		return &TrafficSplitResult{Success: false, CanaryID: canaryID, Error: "weight must be between 0 and 100"}, nil
	}

	baselineWeight := 100 - weight
	phase := determinePhase(weight)
	configID := fmt.Sprintf("%s-config", canaryID)
	upstreamName := upstream
	ns := "default"

	input := &models.TrafficConfigUpsertInput{
		ID: configID, CanaryID: canaryID, Strategy: "nginx",
		Phase: &phase, Namespace: &ns, UpstreamName: &upstreamName,
		BaselineWeight: &baselineWeight, CanaryWeight: &weight,
	}
	if _, err := s.trafficRepo.UpsertConfig(ctx, input); err != nil {
		return nil, fmt.Errorf("failed to save traffic config: %w", err)
	}

	resultMsg := fmt.Sprintf("NGINX upstream weight applied: baseline=%d, canary=%d for %s", baselineWeight, weight, upstream)
	historyID := fmt.Sprintf("%s-%d", canaryID, time.Now().UnixMilli())
	_, _ = s.historyRepo.CreateEntry(ctx, &models.TrafficHistoryCreateInput{
		ID: historyID, CanaryID: canaryID, Success: true, Result: resultMsg,
	})
	return &TrafficSplitResult{Success: true, CanaryID: canaryID, Result: resultMsg}, nil
}

func (s *CanaryService) ExecuteTrafficSplit(ctx context.Context, canaryID string, strategy string, canaryPercent int) (*TrafficSplitResult, error) {
	switch strategy {
	case "istio":
		config, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
		if err != nil || config == nil || config.Host == nil {
			return &TrafficSplitResult{Success: false, CanaryID: canaryID, Error: "no Istio config found for canary"}, nil
		}
		return s.ConfigureIstioVirtualService(ctx, canaryID, *config.Host, canaryPercent)
	case "nginx":
		config, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
		if err != nil || config == nil || config.UpstreamName == nil {
			return &TrafficSplitResult{Success: false, CanaryID: canaryID, Error: "no NGINX config found for canary"}, nil
		}
		return s.ConfigureNGINXWeight(ctx, canaryID, *config.UpstreamName, canaryPercent)
	default:
		return &TrafficSplitResult{Success: false, CanaryID: canaryID, Error: fmt.Sprintf("unknown strategy: %s", strategy)}, nil
	}
}

func (s *CanaryService) GetTrafficHistory(ctx context.Context, canaryID string) ([]models.TrafficHistory, error) {
	if canaryID != "" {
		return s.historyRepo.FindByCanaryID(ctx, canaryID)
	}
	return s.historyRepo.FindAll(ctx)
}

// UpdateWeight updates the weight of a canary deployment.
func (s *CanaryService) UpdateWeight(ctx context.Context, tenantID, id string, weight int) error {
	// Validate that the canary exists and belongs to the tenant
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrCanaryNotFound
	}
	if weight < 0 || weight > 100 {
		return ErrInvalidStatus
	}
	return s.repo.UpdateWeight(ctx, id, weight)
}

func (s *CanaryService) ConfigureTraffic(ctx context.Context, canaryID, strategy, host, upstream string, canaryPercent int) (*TrafficSplitResult, error) {
	if strategy == "istio" {
		if host == "" {
			return nil, fmt.Errorf("host is required for istio strategy")
		}
		return s.ConfigureIstioVirtualService(ctx, canaryID, host, canaryPercent)
	}
	if strategy == "nginx" {
		if upstream == "" {
			return nil, fmt.Errorf("upstream is required for nginx strategy")
		}
		return s.ConfigureNGINXWeight(ctx, canaryID, upstream, canaryPercent)
	}
	return nil, fmt.Errorf("unknown strategy: %s, must be 'istio' or 'nginx'", strategy)
}

// ==================== Increment / Promote / Rollback Traffic ====================

func (s *CanaryService) IncrementTraffic(ctx context.Context, canaryID string) (*models.TrafficConfig, error) {
	config, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
	if err != nil || config == nil {
		return nil, ErrTrafficNotFound
	}
	currentWeight := 0
	if config.CanaryWeight != nil {
		currentWeight = *config.CanaryWeight
	}
	newWeight := currentWeight + 10
	if newWeight > 100 {
		newWeight = 100
	}
	baselineWeight := 100 - newWeight

	updated, err := s.trafficRepo.Update(ctx, canaryID, &models.TrafficConfigUpdateInput{
		BaselineWeight: &baselineWeight, CanaryWeight: &newWeight,
	})
	if err != nil {
		return nil, err
	}

	historyID := fmt.Sprintf("%s-increment-%d", canaryID, time.Now().UnixMilli())
	_, _ = s.historyRepo.CreateEntry(ctx, &models.TrafficHistoryCreateInput{
		ID: historyID, CanaryID: canaryID, Success: true, Result: fmt.Sprintf("Traffic incremented to %d%% canary", newWeight),
	})
	return updated, nil
}

func (s *CanaryService) PromoteCanaryTraffic(ctx context.Context, canaryID string) (*models.TrafficConfig, error) {
	_, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
	if err != nil {
		return nil, ErrTrafficNotFound
	}
	hundred := 100
	zero := 0
	config, err := s.trafficRepo.Update(ctx, canaryID, &models.TrafficConfigUpdateInput{
		CanaryWeight: &hundred, BaselineWeight: &zero,
	})
	if err != nil {
		return nil, err
	}
	historyID := fmt.Sprintf("%s-promote-%d", canaryID, time.Now().UnixMilli())
	_, _ = s.historyRepo.CreateEntry(ctx, &models.TrafficHistoryCreateInput{
		ID: historyID, CanaryID: canaryID, Success: true, Result: fmt.Sprintf("Canary %s promoted to 100%% traffic", canaryID),
	})
	return config, nil
}

func (s *CanaryService) RollbackCanaryTraffic(ctx context.Context, canaryID string) (*models.TrafficConfig, error) {
	_, err := s.trafficRepo.FindByCanaryID(ctx, canaryID)
	if err != nil {
		return nil, ErrTrafficNotFound
	}
	hundred := 100
	zero := 0
	config, err := s.trafficRepo.Update(ctx, canaryID, &models.TrafficConfigUpdateInput{
		CanaryWeight: &zero, BaselineWeight: &hundred,
	})
	if err != nil {
		return nil, err
	}
	historyID := fmt.Sprintf("%s-rollback-%d", canaryID, time.Now().UnixMilli())
	_, _ = s.historyRepo.CreateEntry(ctx, &models.TrafficHistoryCreateInput{
		ID: historyID, CanaryID: canaryID, Success: true, Result: fmt.Sprintf("Canary %s rolled back to 0%% traffic", canaryID),
	})
	return config, nil
}

// ==================== Private Helpers ====================

func (s *CanaryService) generateSimulatedMetrics(ctx context.Context, runID string) ([]models.CanaryMetricResult, error) {
	type metricDef struct {
		name     string
		category models.MetricCategory
	}
	defs := []metricDef{
		{name: "request_latency_p99", category: models.CategoryLatency},
		{name: "error_rate", category: models.CategoryErrorRate},
		{name: "throughput", category: models.CategoryThroughput},
		{name: "cpu_utilization", category: models.CategorySaturation},
	}

	metrics := make([]models.CanaryMetricResult, 0, len(defs))
	for _, d := range defs {
		var baselineValue, canaryValue float64
		switch d.category {
		case models.CategoryLatency:
			baselineValue = 100 + rand.Float64()*50
			canaryValue = baselineValue * (0.9 + rand.Float64()*0.3)
		case models.CategoryErrorRate:
			baselineValue = 0.01 + rand.Float64()*0.02
			canaryValue = baselineValue * (0.5 + rand.Float64()*1.5)
		case models.CategoryThroughput:
			baselineValue = 1000 + rand.Float64()*500
			canaryValue = baselineValue * (0.95 + rand.Float64()*0.15)
		case models.CategorySaturation:
			baselineValue = 50 + rand.Float64()*30
			canaryValue = baselineValue * (0.8 + rand.Float64()*0.5)
		}

		mannWhitneyP := rand.Float64()
		ksStatistic := rand.Float64() * 0.3
		cliffDelta := (canaryValue - baselineValue) / baselineValue

		var verdict models.MetricVerdict
		percentChange := math.Abs(cliffDelta)
		if d.category == models.CategoryErrorRate || d.category == models.CategorySaturation {
			if percentChange < 0.05 {
				verdict = models.VerdictPass
			} else if percentChange < 0.15 {
				verdict = models.VerdictWarn
			} else {
				verdict = models.VerdictFail
			}
		} else if d.category == models.CategoryThroughput {
			if cliffDelta > -0.05 {
				verdict = models.VerdictPass
			} else if cliffDelta > -0.15 {
				verdict = models.VerdictWarn
			} else {
				verdict = models.VerdictFail
			}
		} else {
			if cliffDelta < 0.05 {
				verdict = models.VerdictPass
			} else if cliffDelta < 0.15 {
				verdict = models.VerdictWarn
			} else {
				verdict = models.VerdictFail
			}
		}

		m := &models.CanaryMetricResult{
			ID: uuid.New().String(), RunID: runID, MetricName: d.name,
			BaselineValue: &baselineValue, CanaryValue: &canaryValue,
			MannWhitneyP: &mannWhitneyP, KsStatistic: &ksStatistic, CliffDelta: &cliffDelta,
			Verdict: &verdict, Category: &d.category,
		}
		if err := s.metricRepo.Create(ctx, m); err != nil {
			return nil, fmt.Errorf("failed to save metric %s: %w", d.name, err)
		}
		metrics = append(metrics, *m)
	}
	return metrics, nil
}

func (s *CanaryService) generateSimulatedMLResults(ctx context.Context, runID string, metrics []models.CanaryMetricResult) ([]models.CanaryMLResult, error) {
	modelNames := []string{"xgboost", "random_forest", "logistic_regression"}
	passCount := 0
	for _, m := range metrics {
		if m.Verdict != nil && *m.Verdict == models.VerdictPass {
			passCount++
		}
	}
	healthScore := float64(passCount) / float64(len(metrics))

	results := make([]models.CanaryMLResult, 0, len(modelNames))
	for _, modelName := range modelNames {
		var prediction string
		if healthScore > 0.7 {
			prediction = "healthy"
		} else if healthScore > 0.4 {
			prediction = "uncertain"
		} else {
			prediction = "unhealthy"
		}
		confidence := 0.6 + rand.Float64()*0.35
		shapExplanation := models.JSONMap{
			"latency_contribution":    rand.Float64() * 0.3,
			"error_rate_contribution": rand.Float64() * 0.3,
			"throughput_contribution": rand.Float64() * 0.2,
			"saturation_contribution": rand.Float64() * 0.2,
		}
		ml := &models.CanaryMLResult{
			ID: uuid.New().String(), RunID: runID, ModelName: modelName,
			Prediction: &prediction, Confidence: &confidence, ShapExplanation: &shapExplanation,
		}
		if err := s.mlRepo.Create(ctx, ml); err != nil {
			return nil, fmt.Errorf("failed to save ML result for %s: %w", modelName, err)
		}
		results = append(results, *ml)
	}
	return results, nil
}

func calculateDecision(metrics []models.CanaryMetricResult, mlResults []models.CanaryMLResult) models.AnalysisDecision {
	passCount, failCount, warnCount := 0, 0, 0
	for _, m := range metrics {
		if m.Verdict == nil {
			continue
		}
		switch *m.Verdict {
		case models.VerdictPass:
			passCount++
		case models.VerdictFail:
			failCount++
		case models.VerdictWarn:
			warnCount++
		}
	}
	healthyPred, unhealthyPred := 0, 0
	for _, r := range mlResults {
		if r.Prediction == nil {
			continue
		}
		switch *r.Prediction {
		case "healthy":
			healthyPred++
		case "unhealthy":
			unhealthyPred++
		}
	}
	if failCount > passCount || unhealthyPred > healthyPred {
		return models.DecisionRollback
	}
	if passCount > failCount+warnCount && healthyPred >= unhealthyPred {
		return models.DecisionPromote
	}
	return models.DecisionInconclusive
}

func calculateConfidence(metrics []models.CanaryMetricResult, mlResults []models.CanaryMLResult) float64 {
	passCount := 0
	for _, m := range metrics {
		if m.Verdict != nil && *m.Verdict == models.VerdictPass {
			passCount++
		}
	}
	total := len(metrics)
	if total == 0 {
		total = 1
	}
	metricScore := float64(passCount) / float64(total)

	mlSum := 0.0
	for _, r := range mlResults {
		if r.Confidence != nil {
			mlSum += *r.Confidence
		}
	}
	div := len(mlResults)
	if div == 0 {
		div = 1
	}
	return (metricScore + mlSum/float64(div)) / 2
}

func getDecisionReason(metrics []models.CanaryMetricResult, mlResults []models.CanaryMLResult) string {
	passes, fails := []string{}, []string{}
	for _, m := range metrics {
		if m.Verdict == nil {
			continue
		}
		switch *m.Verdict {
		case models.VerdictPass:
			passes = append(passes, m.MetricName)
		case models.VerdictFail:
			fails = append(fails, m.MetricName)
		}
	}
	parts := []string{}
	if len(passes) > 0 {
		parts = append(parts, fmt.Sprintf("Passed: %s", joinStrings(passes, ", ")))
	}
	if len(fails) > 0 {
		parts = append(parts, fmt.Sprintf("Failed: %s", joinStrings(fails, ", ")))
	}
	healthyML := 0
	for _, r := range mlResults {
		if r.Prediction != nil && *r.Prediction == "healthy" {
			healthyML++
		}
	}
	if healthyML > 0 {
		parts = append(parts, fmt.Sprintf("ML: %d/%d models predict healthy", healthyML, len(mlResults)))
	}
	if len(parts) == 0 {
		return "Automatic analysis"
	}
	return joinStrings(parts, "; ")
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

func determinePhase(canaryPercent int) string {
	if canaryPercent == 0 {
		return "initial"
	}
	if canaryPercent < 100 {
		return "gradual"
	}
	return "full"
}
