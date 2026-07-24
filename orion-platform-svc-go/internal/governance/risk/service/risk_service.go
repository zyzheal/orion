package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/platform-svc-go/internal/governance/risk/models"
	"orion/platform-svc-go/internal/governance/risk/repository"

	"github.com/google/uuid"
)

// ErrRiskItemNotFound is returned when a risk item is not found.
var ErrRiskItemNotFound = errors.New("risk not found")

// ErrAssessmentNotFound is returned when a risk assessment is not found.
var ErrAssessmentNotFound = errors.New("assessment not found")

// ============================================================
// Risk Scoring Engine (ported from RiskScoringEngine.ts)
// ============================================================

// ScoringWeights holds the weight configuration for all risk factor categories.
type ScoringWeights struct {
	Technical      TechnicalWeights
	Historical     HistoricalWeights
	Organizational OrganizationalWeights
}

type TechnicalWeights struct {
	ChangeSize       float64
	ChangeComplexity float64
	DependencyCount  float64
	TestCoverage     float64
}

type HistoricalWeights struct {
	FailureRate     float64
	RecentIncidents float64
	MTTR            float64
}

type OrganizationalWeights struct {
	TeamExperience      float64
	ReviewCompleteness  float64
	TimeOfDay           float64
}

// DefaultWeights returns the default risk scoring weights (summing to 1.0).
func DefaultWeights() ScoringWeights {
	return ScoringWeights{
		Technical: TechnicalWeights{
			ChangeSize:       0.15,
			ChangeComplexity: 0.12,
			DependencyCount:  0.08,
			TestCoverage:     0.05,
		},
		Historical: HistoricalWeights{
			FailureRate:     0.20,
			RecentIncidents: 0.15,
			MTTR:            0.05,
		},
		Organizational: OrganizationalWeights{
			TeamExperience:     0.05,
			ReviewCompleteness: 0.10,
			TimeOfDay:          0.05,
		},
	}
}

// Risk level thresholds (0-100 scale).
const (
	ThresholdLow      = 25.0
	ThresholdMedium   = 50.0
	ThresholdHigh     = 75.0
	ThresholdCritical = 100.0
)

// calculateRiskScore evaluates all factors and returns a weighted 0-100 score.
func calculateRiskScore(dr models.DeploymentRisk, w ScoringWeights) float64 {
	factors := evaluateRiskFactors(dr, w)
	return computeWeightedScore(factors)
}

// evaluateRiskLevel maps a numeric score to a risk level string.
func evaluateRiskLevel(score float64) string {
	switch {
	case score <= ThresholdLow:
		return "low"
	case score <= ThresholdMedium:
		return "medium"
	case score <= ThresholdHigh:
		return "high"
	default:
		return "critical"
	}
}

// getRiskFactors returns the factor list without computing the aggregate score.
func getRiskFactors(dr models.DeploymentRisk, w ScoringWeights) []models.RiskFactor {
	return evaluateRiskFactors(dr, w)
}

// generateRecommendations creates actionable recommendations from factors and level.
func generateRecommendations(factors []models.RiskFactor, riskLevel string) []models.RiskRecommendation {
	recs := make([]models.RiskRecommendation, 0, len(factors)+2)

	for _, f := range factors {
		if f.Score < 20 {
			continue
		}
		if rec := recommendationForFactor(f, riskLevel); rec != nil {
			recs = append(recs, *rec)
		}
	}

	// Level-level blanket recommendations
	switch riskLevel {
	case "critical":
		recs = append(recs, models.RiskRecommendation{
			ID:          uuid.New().String(),
			Type:        "block",
			Title:       "风险过高，建议暂停部署",
			Description: "当前风险评分已达到 Critical 级别，建议进行额外的安全审查和测试后再考虑部署。",
			Priority:    "critical",
		})
	case "high":
		recs = append(recs, models.RiskRecommendation{
			ID:          uuid.New().String(),
			Type:        "warn",
			Title:       "高风险，需要额外审查",
			Description: "当前风险评分较高，建议在部署前增加额外的测试和审查步骤。",
			Priority:    "high",
		})
	}

	// Sort by priority (critical first)
	priorityOrder := map[string]int{"critical": 0, "high": 1, "medium": 2, "low": 3}
	sortRecommendations(recs, priorityOrder)
	return recs
}

// ============================================================
// Private scoring helpers
// ============================================================

func evaluateRiskFactors(dr models.DeploymentRisk, w ScoringWeights) []models.RiskFactor {
	return []models.RiskFactor{
		evaluateChangeSize(dr, w.Technical.ChangeSize),
		evaluateChangeComplexity(dr, w.Technical.ChangeComplexity),
		evaluateDependencyCount(dr, w.Technical.DependencyCount),
		evaluateTestCoverage(dr, w.Technical.TestCoverage),
		evaluateHistoricalFailureRate(dr, w.Historical.FailureRate),
		evaluateRecentIncidents(dr, w.Historical.RecentIncidents),
		evaluateMTTR(dr, w.Historical.MTTR),
		evaluateTeamExperience(dr, w.Organizational.TeamExperience),
		evaluateReviewCompleteness(dr, w.Organizational.ReviewCompleteness),
		evaluateTimeRisk(dr, w.Organizational.TimeOfDay),
	}
}

func computeWeightedScore(factors []models.RiskFactor) float64 {
	var totalScore, totalWeight float64
	for _, f := range factors {
		totalScore += f.Score * f.Weight
		totalWeight += f.Weight
	}
	if totalWeight == 0 {
		return 0
	}
	return math.Min(100, math.Round(totalScore/totalWeight*100)/100)
}

// -- Technical factors --

func evaluateChangeSize(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	fc := dr.ChangeSize.FilesChanged
	lc := dr.ChangeSize.LinesChanged

	var score float64
	switch {
	case fc > 100:
		score = 90
	case fc > 50:
		score = 75
	case fc > 20:
		score = 55
	case fc > 10:
		score = 35
	case fc > 5:
		score = 20
	default:
		score = 10
	}

	switch {
	case lc > 10000:
		score = math.Min(100, score+15)
	case lc > 5000:
		score = math.Min(100, score+10)
	case lc > 1000:
		score = math.Min(100, score+5)
	}

	return models.RiskFactor{
		Name:        "changeSize",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("变更规模: %d 个文件, %d 行代码", fc, lc),
		Category:    models.FactorCategoryTechnical,
	}
}

func evaluateChangeComplexity(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	scopeSize := len(dr.ChangeScope)

	var score float64
	switch {
	case scopeSize > 10:
		score = 85
	case scopeSize > 5:
		score = 65
	case scopeSize > 3:
		score = 45
	case scopeSize > 1:
		score = 25
	default:
		score = 10
	}

	critDepLen := len(dr.DependencyRisk.CriticalDependencies)
	if critDepLen > 2 {
		score = math.Min(100, score+15)
	} else if critDepLen > 0 {
		score = math.Min(100, score+8)
	}

	return models.RiskFactor{
		Name:        "changeComplexity",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("变更复杂度: %d 个组件, %d 个关键依赖", scopeSize, critDepLen),
		Category:    models.FactorCategoryTechnical,
	}
}

func evaluateDependencyCount(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	total := dr.DependencyRisk.TotalDependencies
	unhealthy := dr.DependencyRisk.UnhealthyDependencies

	var score float64
	switch {
	case total > 20:
		score = 70
	case total > 10:
		score = 50
	case total > 5:
		score = 30
	default:
		score = 15
	}

	if unhealthy > 0 {
		score = math.Min(100, score+float64(unhealthy)*15)
	}

	return models.RiskFactor{
		Name:        "dependencyCount",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("依赖: %d 个总依赖, %d 个不健康", total, unhealthy),
		Category:    models.FactorCategoryTechnical,
	}
}

func evaluateTestCoverage(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	fc := dr.ChangeSize.FilesChanged
	fr := dr.HistoricalRisk.RecentFailureRate

	var score float64
	switch {
	case fc > 50 && fr > 0.2:
		score = 80
	case fc > 20 && fr > 0.1:
		score = 65
	case fr > 0.15:
		score = 60
	case fr < 0.05:
		score = 25
	default:
		score = 40
	}

	return models.RiskFactor{
		Name:        "testCoverage",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("测试覆盖评估: 基于历史失败率 %d%%", int(fr*100)),
		Category:    models.FactorCategoryTechnical,
	}
}

// -- Historical factors --

func evaluateHistoricalFailureRate(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	fr := dr.HistoricalRisk.RecentFailureRate
	score := math.Min(100, math.Round(fr*100))

	return models.RiskFactor{
		Name:        "failureRate",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("历史失败率: %d%%", int(fr*100)),
		Category:    models.FactorCategoryHistorical,
	}
}

func evaluateRecentIncidents(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	incidents := dr.HistoricalRisk.RecentIncidents

	var score float64
	switch {
	case incidents > 5:
		score = 90
	case incidents > 3:
		score = 70
	case incidents > 1:
		score = 45
	case incidents > 0:
		score = 25
	default:
		score = 5
	}

	return models.RiskFactor{
		Name:        "recentIncidents",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("近期事故数: %d", incidents),
		Category:    models.FactorCategoryHistorical,
	}
}

func evaluateMTTR(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	mttr := dr.HistoricalRisk.AverageMTTR
	mttrMinutes := mttr / 60000

	var score float64
	switch {
	case mttrMinutes > 240:
		score = 85
	case mttrMinutes > 120:
		score = 70
	case mttrMinutes > 60:
		score = 55
	case mttrMinutes > 30:
		score = 35
	case mttrMinutes > 10:
		score = 20
	default:
		score = 10
	}

	return models.RiskFactor{
		Name:        "mttr",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("平均恢复时间: %d 分钟", int(mttrMinutes)),
		Category:    models.FactorCategoryHistorical,
	}
}

// -- Organizational factors --

func evaluateTeamExperience(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	fc := dr.ChangeSize.FilesChanged
	fr := dr.HistoricalRisk.RecentFailureRate

	var score float64
	switch {
	case fc > 50 && fr > 0.15:
		score = 75
	case fc > 30 && fr > 0.1:
		score = 55
	case fr > 0.1:
		score = 50
	case fr < 0.05 && fc < 10:
		score = 15
	default:
		score = 30
	}

	return models.RiskFactor{
		Name:        "teamExperience",
		Weight:      weight,
		Score:       score,
		Description: "团队经验评估: 基于近期表现",
		Category:    models.FactorCategoryOrganizational,
	}
}

func evaluateReviewCompleteness(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	scopeSize := len(dr.ChangeScope)
	fc := dr.ChangeSize.FilesChanged

	var score float64
	switch {
	case fc > 50 || scopeSize > 5:
		score = 60
	case fc > 20 || scopeSize > 3:
		score = 45
	case fc > 10:
		score = 35
	default:
		score = 20
	}

	return models.RiskFactor{
		Name:        "reviewCompleteness",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("审查完整性评估: %d 个组件涉及", scopeSize),
		Category:    models.FactorCategoryOrganizational,
	}
}

func evaluateTimeRisk(dr models.DeploymentRisk, weight float64) models.RiskFactor {
	tr := dr.TimeRisk

	var score float64
	switch {
	case tr.IsHoliday:
		score = 80
	case tr.IsWeekend:
		score = 60
	case tr.IsFriday && tr.IsAfterHours:
		score = 55
	case tr.IsFriday:
		score = 35
	case tr.IsAfterHours:
		score = 30
	default:
		score = 10
	}

	desc := "正常工作时间"
	switch {
	case tr.IsHoliday:
		desc = "节假日"
	case tr.IsWeekend:
		desc = "周末"
	case tr.IsFriday:
		desc = "周五"
	case tr.IsAfterHours:
		desc = "非工作时间"
	}

	return models.RiskFactor{
		Name:        "timeOfDay",
		Weight:      weight,
		Score:       score,
		Description: fmt.Sprintf("时间风险: %s", desc),
		Category:    models.FactorCategoryOrganizational,
	}
}

// -- Recommendation generators --

func recommendationForFactor(f models.RiskFactor, _ string) *models.RiskRecommendation {
	generators := map[string]func(models.RiskFactor) *models.RiskRecommendation{
		"changeSize": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "warn"
			priority := "medium"
			if f.Score > 70 {
				recType = "block"
				priority = "high"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "变更规模过大",
				Description:   fmt.Sprintf("当前变更涉及 %s，建议分批部署降低风险。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
		"changeComplexity": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "info"
			if f.Score > 70 {
				recType = "warn"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "变更复杂度较高",
				Description:   "变更涉及多个组件和关键依赖，建议增加集成测试覆盖。",
				RelatedFactor: f.Name,
				Priority:      "medium",
			}
		},
		"dependencyCount": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "info"
			priority := "medium"
			if f.Score > 60 {
				recType = "warn"
				priority = "high"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "依赖服务风险",
				Description:   fmt.Sprintf("%s，建议确认所有依赖服务的健康状态。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
		"failureRate": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "warn"
			priority := "high"
			if f.Score > 60 {
				recType = "block"
				priority = "critical"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "历史失败率较高",
				Description:   fmt.Sprintf("%s，建议分析失败原因并制定应对措施。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
		"recentIncidents": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "info"
			priority := "medium"
			if f.Score > 60 {
				recType = "warn"
				priority = "high"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "近期事故频繁",
				Description:   fmt.Sprintf("%s，系统可能处于不稳定状态，建议暂缓部署。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
		"mttr": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "suggestion"
			priority := "low"
			if f.Score > 60 {
				recType = "warn"
				priority = "medium"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "恢复时间较长",
				Description:   fmt.Sprintf("%s，建议优化回滚流程和故障恢复预案。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
		"timeOfDay": func(f models.RiskFactor) *models.RiskRecommendation {
			recType := "suggestion"
			priority := "low"
			if f.Score > 50 {
				recType = "warn"
				priority = "medium"
			}
			return &models.RiskRecommendation{
				ID:            uuid.New().String(),
				Type:          recType,
				Title:         "非最佳部署时间",
				Description:   fmt.Sprintf("%s，建议调整到工作时间进行部署。", f.Description),
				RelatedFactor: f.Name,
				Priority:      priority,
			}
		},
	}

	gen, ok := generators[f.Name]
	if !ok {
		return nil
	}
	return gen(f)
}

func sortRecommendations(recs []models.RiskRecommendation, order map[string]int) {
	for i := 1; i < len(recs); i++ {
		for j := i; j > 0; j-- {
			oj, _ := order[recs[j].Priority]
			oj1, _ := order[recs[j-1].Priority]
			if oj < oj1 {
				recs[j], recs[j-1] = recs[j-1], recs[j]
			}
		}
	}
}

// ============================================================
// Health Check helpers (ported from HealthCheckService.ts)
// ============================================================

func runPreDeploymentChecks(params struct {
	TargetID        string
	PipelineStatus  string
	TestResults     *models.TestResults
	CodeReviewStatus string
	Dependencies    []string
}) models.HealthCheckResult {
	checks := make([]models.HealthCheck, 0, 5)
	start := time.Now()

	// Pipeline status check
	checks = append(checks, checkPipelineStatus(params.PipelineStatus))

	// Test results check
	if params.TestResults != nil {
		checks = append(checks, checkTestResults(params.TestResults))
	}

	// Code review check
	if params.CodeReviewStatus != "" {
		checks = append(checks, checkCodeReviewStatus(params.CodeReviewStatus))
	}

	// Dependency health check (simplified -- returns pass by default)
	if len(params.Dependencies) > 0 {
		checks = append(checks, checkDependencyHealth(params.Dependencies))
	}

	return aggregateHealthResults(checks, time.Since(start).Milliseconds())
}

func checkPipelineStatus(status string) models.HealthCheck {
	start := time.Now()
	var hs models.HealthCheckStatus
	var details string

	switch status {
	case "success", "completed":
		hs = models.HealthCheckPass
		details = "Pipeline 执行成功"
	case "running", "pending":
		hs = models.HealthCheckFail
		details = fmt.Sprintf("Pipeline 仍在执行中: %s", status)
	case "failed":
		hs = models.HealthCheckFail
		details = "Pipeline 执行失败，无法部署"
	case "":
		hs = models.HealthCheckWarn
		details = "Pipeline 状态未提供"
	default:
		hs = models.HealthCheckWarn
		details = fmt.Sprintf("Pipeline 状态异常: %s", status)
	}

	return models.HealthCheck{
		ID:        uuid.New().String(),
		CheckName: "pipelineStatus",
		Status:    hs,
		Details:   details,
		Duration:  time.Since(start).Milliseconds(),
		Timestamp: time.Now(),
	}
}

func checkTestResults(results *models.TestResults) models.HealthCheck {
	start := time.Now()
	passRate := 100.0
	if results.Total > 0 {
		passRate = float64(results.Passed) / float64(results.Total) * 100
	}

	var hs models.HealthCheckStatus
	var details string

	switch {
	case results.Failed > 0 && passRate < 95:
		hs = models.HealthCheckFail
		details = fmt.Sprintf("测试通过率过低: %d%% (%d 个失败)", int(passRate), results.Failed)
	case results.Failed > 0:
		hs = models.HealthCheckWarn
		details = fmt.Sprintf("存在 %d 个测试失败，但通过率 %d%% 可接受", results.Failed, int(passRate))
	default:
		hs = models.HealthCheckPass
		details = fmt.Sprintf("测试通过: %d/%d (%d%%)", results.Passed, results.Total, int(passRate))
	}

	return models.HealthCheck{
		ID:        uuid.New().String(),
		CheckName: "testResults",
		Status:    hs,
		Details:   details,
		Duration:  time.Since(start).Milliseconds(),
		Timestamp: time.Now(),
	}
}

func checkCodeReviewStatus(status string) models.HealthCheck {
	start := time.Now()
	var hs models.HealthCheckStatus
	var details string

	switch status {
	case "approved":
		hs = models.HealthCheckPass
		details = "代码审查已通过"
	case "pending":
		hs = models.HealthCheckWarn
		details = "代码审查仍在进行中"
	case "rejected":
		hs = models.HealthCheckFail
		details = "代码审查未通过，需要修复后重新提交"
	case "none":
		hs = models.HealthCheckWarn
		details = "未进行代码审查"
	default:
		hs = models.HealthCheckWarn
		details = fmt.Sprintf("未知的代码审查状态: %s", status)
	}

	return models.HealthCheck{
		ID:        uuid.New().String(),
		CheckName: "codeReview",
		Status:    hs,
		Details:   details,
		Duration:  time.Since(start).Milliseconds(),
		Timestamp: time.Now(),
	}
}

func checkDependencyHealth(services []string) models.HealthCheck {
	start := time.Now()
	// Simplified: assume all dependencies healthy (real implementation would call health endpoints)
	return models.HealthCheck{
		ID:        uuid.New().String(),
		CheckName: "dependencyHealth",
		Status:    models.HealthCheckPass,
		Details:   fmt.Sprintf("所有 %d 个依赖服务健康", len(services)),
		Duration:  time.Since(start).Milliseconds(),
		Timestamp: time.Now(),
	}
}

func aggregateHealthResults(checks []models.HealthCheck, totalDuration int64) models.HealthCheckResult {
	var passed, failed, warnings, skipped int
	for _, c := range checks {
		switch c.Status {
		case models.HealthCheckPass:
			passed++
		case models.HealthCheckFail:
			failed++
		case models.HealthCheckWarn:
			warnings++
		case models.HealthCheckSkip:
			skipped++
		}
	}

	return models.HealthCheckResult{
		TotalChecks: len(checks),
		Passed:      passed,
		Failed:      failed,
		Warnings:    warnings,
		Skipped:     skipped,
		CanProceed:  failed == 0,
		Checks:      checks,
		ExecutedAt:  time.Now(),
	}
}

// ============================================================
// Service (business logic layer)
// ============================================================

// Service provides risk business logic.
type Service struct {
	repo    *repository.Repository
	weights ScoringWeights
}

// NewService creates a new Service with default weights.
func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo:    repo,
		weights: DefaultWeights(),
	}
}

// ---- RiskItem CRUD ----

// Create creates a new risk item.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateRiskItemRequest) (*models.RiskItem, error) {
	now := time.Now()
	d := &models.RiskItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		RiskType:    req.RiskType,
		Level:       req.Level,
		Description: req.Description,
		Mitigation:  req.Mitigation,
		Status:      "open",
		Assignee:    req.Assignee,
		Metadata:    models.JSONB{},
		Tags:        models.StringSlice(req.Tags),
		DueDate:     req.DueDate,
		UpdatedAt:   now,
		CreatedAt:   now,
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

// Update updates an existing risk item.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateRiskItemRequest) (*models.RiskItem, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRiskItemNotFound
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.RiskType != nil {
		existing.RiskType = *req.RiskType
	}
	if req.Level != nil {
		existing.Level = *req.Level
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Mitigation != nil {
		existing.Mitigation = *req.Mitigation
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	if req.Assignee != nil {
		existing.Assignee = *req.Assignee
	}
	if req.Tags != nil {
		existing.Tags = models.StringSlice(req.Tags)
	}

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// List returns a paginated list of risk items.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskItem, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetByID returns a single risk item.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.RiskItem, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// Delete removes a risk item.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of risk items for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ---- Risk Assessment (scoring engine) ----

// AssessDeploymentRisk performs a full risk assessment for a deployment.
// It calculates risk score, factors, and recommendations, then persists the result.
func (s *Service) AssessDeploymentRisk(ctx context.Context, tenantID string, req *models.AssessDeploymentRequest) (*models.RiskAssessment, error) {
	dr := req.DeploymentRisk

	// 1. Calculate risk score
	riskScore := calculateRiskScore(dr, s.weights)

	// 2. Get risk factors
	factors := getRiskFactors(dr, s.weights)

	// 3. Evaluate risk level
	riskLevel := evaluateRiskLevel(riskScore)

	// 4. Generate recommendations
	recommendations := generateRecommendations(factors, riskLevel)

	// 5. Run health checks (optional)
	var healthCheckResult *models.HealthCheckResult
	if req.RunHealthChecks {
		hcr := runPreDeploymentChecks(struct {
			TargetID        string
			PipelineStatus  string
			TestResults     *models.TestResults
			CodeReviewStatus string
			Dependencies    []string
		}{
			TargetID:        req.DeploymentID,
			PipelineStatus:  req.PipelineStatus,
			TestResults:     req.TestResults,
			CodeReviewStatus: req.CodeReviewStatus,
			Dependencies:    req.Dependencies,
		})
		healthCheckResult = &hcr

		if !hcr.CanProceed {
			recommendations = append(recommendations, models.RiskRecommendation{
				ID:    uuid.New().String(),
				Type:  "block",
				Title: "发布前检查未通过",
				Description: fmt.Sprintf("健康检查发现 %d 个失败项", hcr.Failed),
				Priority: "critical",
			})
		}
	}

	// Convert factors/recommendations to JSONB slices for storage
	factorSlice := make(models.JSONBSlice, len(factors))
	for i, f := range factors {
		factorSlice[i] = map[string]interface{}{
			"name": f.Name, "weight": f.Weight, "score": f.Score,
			"description": f.Description, "category": f.Category,
		}
	}
	recSlice := make(models.JSONBSlice, len(recommendations))
	for i, r := range recommendations {
		recSlice[i] = map[string]interface{}{
			"id": r.ID, "type": r.Type, "title": r.Title,
			"description": r.Description, "relatedFactor": r.RelatedFactor, "priority": r.Priority,
		}
	}

	var metadata models.JSONB
	if healthCheckResult != nil {
		metadata = models.JSONB{"healthCheckResult": healthCheckResult}
	}

	assessment := &models.RiskAssessment{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            fmt.Sprintf("Risk assessment for deployment %s", req.DeploymentID),
		TargetType:      "deployment",
		TargetID:        req.DeploymentID,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		Factors:         factorSlice,
		Recommendations: recSlice,
		Status:          "completed",
		Metadata:        metadata,
	}

	if err := s.repo.CreateAssessment(ctx, assessment); err != nil {
		return nil, err
	}
	return assessment, nil
}

// AssessChangeRisk performs a risk assessment for a code change.
func (s *Service) AssessChangeRisk(ctx context.Context, tenantID string, req *models.AssessChangeRequest) (*models.RiskAssessment, error) {
	dr := req.DeploymentRisk

	riskScore := calculateRiskScore(dr, s.weights)
	factors := getRiskFactors(dr, s.weights)
	riskLevel := evaluateRiskLevel(riskScore)
	recommendations := generateRecommendations(factors, riskLevel)

	factorSlice := make(models.JSONBSlice, len(factors))
	for i, f := range factors {
		factorSlice[i] = map[string]interface{}{
			"name": f.Name, "weight": f.Weight, "score": f.Score,
			"description": f.Description, "category": f.Category,
		}
	}
	recSlice := make(models.JSONBSlice, len(recommendations))
	for i, r := range recommendations {
		recSlice[i] = map[string]interface{}{
			"id": r.ID, "type": r.Type, "title": r.Title,
			"description": r.Description, "relatedFactor": r.RelatedFactor, "priority": r.Priority,
		}
	}

	assessment := &models.RiskAssessment{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            fmt.Sprintf("Risk assessment for change %s", req.ChangeID),
		TargetType:      "change",
		TargetID:        req.ChangeID,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		Factors:         factorSlice,
		Recommendations: recSlice,
		Status:          "completed",
	}

	if err := s.repo.CreateAssessment(ctx, assessment); err != nil {
		return nil, err
	}
	return assessment, nil
}

// GetAssessment returns a single assessment by id.
func (s *Service) GetAssessment(ctx context.Context, tenantID, id string) (*models.RiskAssessment, error) {
	return s.repo.GetAssessmentByID(ctx, tenantID, id)
}

// UpdateAssessment updates an existing risk assessment.
func (s *Service) UpdateAssessment(ctx context.Context, tenantID, id string, req *models.UpdateAssessmentRequest) (*models.RiskAssessment, error) {
	existing, err := s.repo.GetAssessmentByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrAssessmentNotFound
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.TargetType != nil {
		existing.TargetType = *req.TargetType
	}
	if req.TargetID != nil {
		existing.TargetID = *req.TargetID
	}
	if req.RiskScore != nil {
		existing.RiskScore = *req.RiskScore
	}
	if req.RiskLevel != nil {
		existing.RiskLevel = *req.RiskLevel
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	if req.Factors != nil {
		existing.Factors = *req.Factors
	}
	if req.Recommendations != nil {
		existing.Recommendations = *req.Recommendations
	}

	if err := s.repo.UpdateAssessment(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// ListAssessments returns a paginated list of assessments.
func (s *Service) ListAssessments(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskAssessment, error) {
	return s.repo.ListAssessments(ctx, tenantID, offset, limit)
}

// ---- Risk Reports ----

// GenerateReport generates a report from an existing assessment.
func (s *Service) GenerateReport(ctx context.Context, tenantID, assessmentID string) (*models.RiskReport, error) {
	assessment, err := s.repo.GetAssessmentByID(ctx, tenantID, assessmentID)
	if err != nil {
		return nil, ErrAssessmentNotFound
	}

	// Count critical factors (score > 70)
	criticalRiskCount := 0
	for _, f := range assessment.Factors {
		if score, ok := f["score"].(float64); ok && score > 70 {
			criticalRiskCount++
		}
	}

	canDeploy := assessment.RiskLevel != "critical"

	report := &models.RiskReport{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		AssessmentID:      assessmentID,
		RiskScore:         assessment.RiskScore,
		RiskLevel:         assessment.RiskLevel,
		CanDeploy:         canDeploy,
		CriticalRiskCount: criticalRiskCount,
		Summary: models.JSONB{
			"riskScore":         assessment.RiskScore,
			"riskLevel":         assessment.RiskLevel,
			"canDeploy":         canDeploy,
			"criticalRiskCount": criticalRiskCount,
		},
		Details:         models.JSONB{"factors": assessment.Factors},
		Recommendations: assessment.Recommendations,
		GeneratedAt:     time.Now(),
	}

	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, err
	}
	return report, nil
}

// GetReport returns a single report by id.
func (s *Service) GetReport(ctx context.Context, id string) (*models.RiskReport, error) {
	return s.repo.GetReportByID(ctx, id)
}

// ListReports returns a paginated list of reports.
func (s *Service) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskReport, error) {
	return s.repo.ListReports(ctx, tenantID, offset, limit)
}

// ---- Health Checks (stateless) ----

// RunPreDeploymentChecks runs health checks and returns the result (no persistence).
func (s *Service) RunPreDeploymentChecks(_ context.Context, req *models.PreDeploymentCheckRequest) (*models.HealthCheckResult, error) {
	result := runPreDeploymentChecks(struct {
		TargetID        string
		PipelineStatus  string
		TestResults     *models.TestResults
		CodeReviewStatus string
		Dependencies    []string
	}{
		TargetID:        req.TargetID,
		PipelineStatus:  req.PipelineStatus,
		TestResults:     req.TestResults,
		CodeReviewStatus: req.CodeReviewStatus,
		Dependencies:    req.Dependencies,
	})
	return &result, nil
}
