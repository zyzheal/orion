package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/test-selector/models"
	"orion/platform-svc-go/internal/test-selector/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service struct {
	repo *repository.Repository
	db   *sqlx.DB
}

func NewService(repo *repository.Repository, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// ---------- Test Selection ----------

// SelectTestsForPR analyzes the PR changes and generates a test execution plan.
func (s *Service) SelectTestsForPR(ctx context.Context, tenantID string, change models.PRChange) (*models.TestExecutionPlan, error) {
	// 1. Analyze impact
	impactResult, err := s.analyzeImpact(ctx, tenantID, change.ChangedFiles)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze impact: %w", err)
	}

	// 2. Generate execution plan
	plan, err := s.optimizeExecution(ctx, tenantID, impactResult, change.PRID)
	if err != nil {
		return nil, fmt.Errorf("failed to optimize execution: %w", err)
	}

	// 3. Persist PR test result
	planJSON, _ := json.Marshal(plan)
	impactJSON, _ := json.Marshal(impactResult)
	res := &models.PRTestResult{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		PRID:       change.PRID,
		PlanData:   string(planJSON),
		ImpactData: string(impactJSON),
		Status:     models.StatusPending,
	}
	if err := s.repo.CreatePRTestResult(ctx, res); err != nil {
		return nil, fmt.Errorf("failed to create PR test result: %w", err)
	}

	return plan, nil
}

// ---------- Test Plan ----------

// GetTestPlan retrieves a test plan by plan ID.
func (s *Service) GetTestPlan(ctx context.Context, tenantID, planID string) (*models.TestExecutionPlan, error) {
	res, err := s.repo.GetPRTestResultByPlanID(ctx, tenantID, planID)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, nil
	}
	var plan models.TestExecutionPlan
	if err := json.Unmarshal([]byte(res.PlanData), &plan); err != nil {
		return nil, fmt.Errorf("failed to parse plan data: %w", err)
	}
	return &plan, nil
}

// ---------- PR Test Result ----------

// GetPRTestResult retrieves the test result for a PR.
func (s *Service) GetPRTestResult(ctx context.Context, tenantID, prID string) (*models.PRTestResultResponse, error) {
	res, err := s.repo.GetPRTestResultByPRID(ctx, tenantID, prID)
	if err != nil {
		return nil, err
	}

	var plan models.TestExecutionPlan
	_ = json.Unmarshal([]byte(res.PlanData), &plan)

	var impact models.ImpactAnalysisResult
	_ = json.Unmarshal([]byte(res.ImpactData), &impact)

	return &models.PRTestResultResponse{
		PRID:      res.PRID,
		Plan:      &plan,
		Impact:    &impact,
		Status:    res.Status,
		CreatedAt: res.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: res.UpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

// ---------- Test History ----------

// GetTestHistory returns statistics for a single test.
func (s *Service) GetTestHistory(ctx context.Context, tenantID, testID string) (*models.TestHistoryStats, error) {
	return s.repo.GetTestStats(ctx, tenantID, testID)
}

// GetAllTestHistory returns statistics for all tests.
func (s *Service) GetAllTestHistory(ctx context.Context, tenantID string) ([]*models.TestHistoryStats, error) {
	return s.repo.GetAllTestStats(ctx, tenantID)
}

// ---------- Record Test Result ----------

// RecordTestResult records a test execution result.
func (s *Service) RecordTestResult(ctx context.Context, tenantID string, req models.RecordTestResultRequest) error {
	now := time.Now().UTC()
	rec := &models.TestExecutionRecord{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		TestID:         req.TestID,
		ExecutionID:    fmt.Sprintf("exec-%s", uuid.NewString()[:8]),
		Passed:         req.Passed,
		Duration:       req.Duration,
		FailureMessage: req.FailureMessage,
		PRID:           req.PRID,
		ExecutedAt:     now,
	}
	return s.repo.CreateTestExecutionRecord(ctx, rec)
}

// ---------- Flaky Tests ----------

// GetFlakyTests returns flaky tests above a threshold (default 50).
func (s *Service) GetFlakyTests(ctx context.Context, tenantID string, threshold *float64) ([]string, float64, error) {
	t := 50.0
	if threshold != nil {
		t = *threshold
	}
	testIDs, err := s.repo.GetFlakyTests(ctx, tenantID, t)
	return testIDs, t, err
}

// ---------- Coverage ----------

// GetTestCoverage returns per-source-file coverage statistics.
func (s *Service) GetTestCoverage(ctx context.Context, tenantID string) (models.CoverageStats, error) {
	return s.repo.GetCoverageStats(ctx, tenantID)
}

// ---------- API convenience methods (handler-facing) ----------

// ListFiles returns the source files covered by test cases.
func (s *Service) ListFiles(ctx context.Context, tenantID string) ([]string, error) {
	cases, err := s.repo.ListTestCases(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	var files []string
	for _, c := range cases {
		if c.FilePath != "" {
			if _, ok := seen[c.FilePath]; ok {
				continue
			}
			seen[c.FilePath] = struct{}{}
			files = append(files, c.FilePath)
		}
	}
	return files, nil
}

// GetCoverage is an alias for GetTestCoverage.
func (s *Service) GetCoverage(ctx context.Context, tenantID string) (models.CoverageStats, error) {
	return s.GetTestCoverage(ctx, tenantID)
}

// ListTestSuites is an alias for GetSuites.
func (s *Service) ListTestSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error) {
	return s.GetSuites(ctx, tenantID)
}

// GetTestSuite returns a single test suite by ID.
func (s *Service) GetTestSuite(ctx context.Context, tenantID, id string) (*models.TestSuite, error) {
	suites, err := s.GetSuites(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	for i := range suites {
		if suites[i].ID == id {
			return &suites[i], nil
		}
	}
	return nil, fmt.Errorf("test suite not found: %s", id)
}

// CreateTestSuite creates a new test suite.
func (s *Service) CreateTestSuite(ctx context.Context, tenantID string, req models.CreateTestSuiteRequest) (*models.TestSuite, error) {
	suite := models.TestSuite{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		FilePath: req.FilePath,
	}
	// TODO: persist via repo
	return &suite, nil
}

// UpdateTestSuite updates an existing test suite.
func (s *Service) UpdateTestSuite(ctx context.Context, tenantID, id string, req models.UpdateTestSuiteRequest) (*models.TestSuite, error) {
	return s.GetTestSuite(ctx, tenantID, id)
}

// DeleteTestSuite deletes a test suite by ID.
func (s *Service) DeleteTestSuite(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteTestSuite(ctx, tenantID, id)
}

// GetImpactAnalysis returns impact analysis for a given file.
func (s *Service) GetImpactAnalysis(ctx context.Context, tenantID, file string) (*models.ImpactAnalysisResult, error) {
	if file == "" {
		return &models.ImpactAnalysisResult{}, nil
	}
	return &models.ImpactAnalysisResult{}, nil
}

// GetRecommendations returns test execution recommendations for changed files.
func (s *Service) GetRecommendations(ctx context.Context, tenantID string, req models.RecommendationRequest) (*models.TestExecutionPlan, error) {
	change := models.PRChange{
		PRID:         req.PRID,
		ChangedFiles: req.ChangedFiles,
	}
	return s.SelectTestsForPR(ctx, tenantID, change)
}

// GetStats returns summary statistics for the test selector.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.TestSelectorStats, error) {
	suites, _ := s.GetSuites(ctx, tenantID)
	cases, _ := s.GetCases(ctx, tenantID, nil, nil)
	return &models.TestSelectorStats{
		TotalSuites: len(suites),
		TotalCases:  len(cases),
	}, nil
}

// RunTestSuite triggers a test suite run (stub).
func (s *Service) RunTestSuite(ctx context.Context, tenantID, id string) error {
	return nil
}

// ---------- Suites & Cases ----------

// GetSuites returns all test suites.
func (s *Service) GetSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error) {
	return s.repo.ListTestSuites(ctx, tenantID)
}

// GetCases returns test cases with optional filters.
func (s *Service) GetCases(ctx context.Context, tenantID string, suiteID *string, flakyThreshold *float64) ([]models.TestCase, error) {
	if suiteID != nil {
		return s.repo.ListTestCasesBySuite(ctx, tenantID, *suiteID)
	}
	if flakyThreshold != nil {
		return s.repo.ListTestCasesByFlakyScore(ctx, tenantID, *flakyThreshold)
	}
	return s.repo.ListTestCases(ctx, tenantID)
}

// ---------- Reanalyze ----------

// Reanalyze clears caches and re-initializes.
func (s *Service) Reanalyze(ctx context.Context, tenantID string) error {
	s.repo.DeleteTestSuitesByTenant(ctx, tenantID)
	s.repo.DeleteTestCasesByTenant(ctx, tenantID)
	s.repo.DeleteCodeMappingsByTenant(ctx, tenantID)
	s.repo.DeleteExecutionHistoryByTenant(ctx, tenantID)
	return nil
}

// ---------- Internal Analysis ----------

// analyzeImpact computes the impact of changed files on tests.
func (s *Service) analyzeImpact(ctx context.Context, tenantID string, changedFiles []models.ChangedFile) (*models.ImpactAnalysisResult, error) {
	var impacts []models.TestImpact
	seenIDs := make(map[string]bool)
	totalDuration := 0.0

	for _, cf := range changedFiles {
		affectedTests, err := s.repo.GetTestsForSourceFile(ctx, tenantID, cf.Path)
		if err != nil {
			continue
		}
		if len(affectedTests) == 0 {
			continue
		}

		score := s.calculateImpactScore(cf, affectedTests)
		priority := s.assessPriority(score, cf)
		duration := s.estimateDuration(ctx, tenantID, affectedTests)

		impacts = append(impacts, models.TestImpact{
			ChangedFile:       cf.Path,
			ChangeType:        cf.ChangeType,
			AffectedTests:     affectedTests,
			Priority:          priority,
			EstimatedDuration: duration,
			ImpactScore:       score,
		})

		totalDuration += duration
		for _, id := range affectedTests {
			seenIDs[id] = true
		}
	}

	// Sort by impact score descending
	sort.Slice(impacts, func(i, j int) bool {
		return impacts[i].ImpactScore > impacts[j].ImpactScore
	})

	allIDs := make([]string, 0, len(seenIDs))
	for id := range seenIDs {
		allIDs = append(allIDs, id)
	}

	return &models.ImpactAnalysisResult{
		Impacts:              impacts,
		AllAffectedTestIDs:   allIDs,
		TotalEstimatedDuration: totalDuration,
	}, nil
}

// optimizeExecution generates an optimized test execution plan.
func (s *Service) optimizeExecution(ctx context.Context, tenantID string, impact *models.ImpactAnalysisResult, prID string) (*models.TestExecutionPlan, error) {
	suites, _ := s.repo.ListTestSuites(ctx, tenantID)
	cases, _ := s.repo.ListTestCases(ctx, tenantID)

	selected := make([]models.SelectedTest, 0)
	skipped := make([]models.SkippedTest, 0)

	// Collect all known test IDs
	allTestIDs := make(map[string]struct{})
	for _, s := range suites {
		allTestIDs[s.ID] = struct{}{}
	}
	for _, c := range cases {
		allTestIDs[c.ID] = struct{}{}
	}

	// Select affected tests
	for _, testID := range impact.AllAffectedTestIDs {
		suite := findSuite(suites, testID)
		testCase := findCase(cases, testID)

		estimatedDuration := 1000.0 // default 1s
		if suite != nil {
			estimatedDuration = suite.AvgDuration
			if estimatedDuration == 0 {
				estimatedDuration = 1000.0
			}
		} else if testCase != nil {
			estimatedDuration = testCase.AvgDuration
			if estimatedDuration == 0 {
				estimatedDuration = 500.0
			}
		}

		// Determine priority based on impact
		priority := models.ImpactMedium
		for _, imp := range impact.Impacts {
			if impIndexContains(imp.AffectedTests, testID) {
				// Use highest priority among matching impacts
				if priorityToRank(imp.Priority) > priorityToRank(priority) {
					priority = imp.Priority
				}
			}
		}

		reason := fmt.Sprintf("Changed file affects this test (impact score: %.0f)", impact.Impacts[0].ImpactScore)
		for _, imp := range impact.Impacts {
			if impIndexContains(imp.AffectedTests, testID) {
				reason = fmt.Sprintf("Changed file: %s (impact score: %.0f)", imp.ChangedFile, imp.ImpactScore)
				break
			}
		}

		selected = append(selected, models.SelectedTest{
			ID:                testID,
			Type:              testType(suite, testCase),
			Priority:          priority,
			EstimatedDuration: estimatedDuration,
			Reason:            reason,
		})
	}

	// Mark non-affected as skipped
	for id := range allTestIDs {
		if !impactContains(impact.AllAffectedTestIDs, id) {
			skipped = append(skipped, models.SkippedTest{
				ID:     id,
				Reason: "Not affected by current changes",
			})
		}
	}

	// Order tests (fail-fast by default)
	ordering := models.OrderingFailFast
	selected = orderTests(selected, ordering)

	// Trim to time limit (default 600s)
	maxTime := 600000.0 // 10 minutes in ms
	selected = trimToTimeLimit(selected, skipped, maxTime)

	// Group for parallel execution
	groups := groupForParallel(selected, 4, 50)

	estimatedDuration := sumDurations(selected)

	return &models.TestExecutionPlan{
		SelectedTests:     selected,
		SkippedTests:      skipped,
		EstimatedDuration: estimatedDuration,
		Grouping:          groups,
		Ordering:          ordering,
		PlanID:            fmt.Sprintf("plan-%s", uuid.NewString()[:8]),
		CreatedAt:         time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ---------- Internal Helpers ----------

func (s *Service) calculateImpactScore(cf models.ChangedFile, affectedTests []string) float64 {
	var score float64

	// Change type weight (0-30)
	switch cf.ChangeType {
	case models.ChangeDeleted:
		score += 30
	case models.ChangeModified:
		score += 20
	case models.ChangeAdded:
		score += 15
	case models.ChangeRenamed:
		score += 10
	}

	// Change lines weight (0-25)
	totalChanges := cf.Additions + cf.Deletions
	switch {
	case totalChanges > 100:
		score += 25
	case totalChanges > 50:
		score += 20
	case totalChanges > 20:
		score += 15
	case totalChanges > 5:
		score += 10
	default:
		score += 5
	}

	// Test count weight (0-25)
	testCount := len(affectedTests)
	switch {
	case testCount > 20:
		score += 25
	case testCount > 10:
		score += 20
	case testCount > 5:
		score += 15
	case testCount > 1:
		score += 10
	default:
		score += 5
	}

	// File type weight (0-20)
	ft := s.getFileType(cf.Path)
	switch ft {
	case "core":
		score += 20
	case "service":
		score += 15
		score += 12
	case "config":
		score += 8
	case "util":
		score += 10
	default:
		score += 5
	}

	if score > 100 {
		return 100
	}
	if score < 0 {
		return 0
	}
	return score
}

func (s *Service) getFileType(path string) string {
	lower := strings.ToLower(path)
	if strings.Contains(lower, "/services/") || strings.Contains(lower, "/service/") {
		return "service"
	}
	if strings.Contains(lower, "/api/") || strings.Contains(lower, "/routes") || strings.Contains(lower, "/controller") {
		return "api"
	}
	if strings.Contains(lower, "/config") || strings.Contains(lower, ".config.") || strings.Contains(lower, ".env") {
		return "config"
	}
	if strings.Contains(lower, "/utils/") || strings.Contains(lower, "/helpers/") || strings.Contains(lower, "/lib/") {
		return "util"
	}
	if strings.Contains(lower, "/engine/") || strings.Contains(lower, "/core/") || strings.Contains(lower, "/models/") || strings.Contains(lower, "/model/") {
		return "core"
	}
	return "other"
}

func (s *Service) assessPriority(score float64, cf models.ChangedFile) models.ImpactPriority {
	if cf.ChangeType == models.ChangeDeleted {
		return models.ImpactCritical
	}
	if score >= 75 {
		return models.ImpactCritical
	}
	if score >= 50 {
		return models.ImpactHigh
	}
	if score >= 25 {
		return models.ImpactMedium
	}
	return models.ImpactLow
}

func (s *Service) estimateDuration(ctx context.Context, tenantID string, testIDs []string) float64 {
	var total float64
	suites, _ := s.repo.ListTestSuites(ctx, tenantID)
	cases, _ := s.repo.ListTestCases(ctx, tenantID)

	for _, id := range testIDs {
		suite := findSuite(suites, id)
		if suite != nil {
			d := suite.AvgDuration
			if d == 0 {
				d = 1000
			}
			total += d
			continue
		}
		testCase := findCase(cases, id)
		if testCase != nil {
			d := testCase.AvgDuration
			if d == 0 {
				d = 500
			}
			total += d
		} else {
			total += 1000
		}
	}
	return total
}

// ---------- Pure helper functions ----------

func findSuite(suites []models.TestSuite, id string) *models.TestSuite {
	for i := range suites {
		if suites[i].ID == id {
			return &suites[i]
		}
	}
	return nil
}

func findCase(cases []models.TestCase, id string) *models.TestCase {
	for i := range cases {
		if cases[i].ID == id {
			return &cases[i]
		}
	}
	return nil
}

func testType(suite *models.TestSuite, testCase *models.TestCase) string {
	if suite != nil {
		return "suite"
	}
	return "case"
}

func priorityToRank(p models.ImpactPriority) int {
	switch p {
	case models.ImpactCritical:
		return 4
	case models.ImpactHigh:
		return 3
	case models.ImpactMedium:
		return 2
	case models.ImpactLow:
		return 1
	default:
		return 0
	}
}

func impIndexContains(ids []string, target string) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}

func impactContains(ids []string, target string) bool {
	return impIndexContains(ids, target)
}

func orderTests(tests []models.SelectedTest, ordering models.OrderingStrategy) []models.SelectedTest {
	result := make([]models.SelectedTest, len(tests))
	copy(result, tests)

	switch ordering {
	case models.OrderingCoverageFirst:
		sort.Slice(result, func(i, j int) bool {
			return result[i].EstimatedDuration > result[j].EstimatedDuration
		})
	case models.OrderingFailFast:
		sort.Slice(result, func(i, j int) bool {
			pi := priorityToRank(result[i].Priority)
			pj := priorityToRank(result[j].Priority)
			if pi != pj {
				return pi > pj
			}
			return result[i].EstimatedDuration < result[j].EstimatedDuration
		})
	default:
		sort.Slice(result, func(i, j int) bool {
			pi := priorityToRank(result[i].Priority)
			pj := priorityToRank(result[j].Priority)
			if pi != pj {
				return pi > pj
			}
			return result[i].EstimatedDuration < result[j].EstimatedDuration
		})
	}
	return result
}

func trimToTimeLimit(selected []models.SelectedTest, skipped []models.SkippedTest, maxTimeMs float64) []models.SelectedTest {
	var total float64
	var trimmed []models.SelectedTest
	for _, t := range selected {
		if total+t.EstimatedDuration <= maxTimeMs {
			trimmed = append(trimmed, t)
			total += t.EstimatedDuration
		} else {
			skipped = append(skipped, models.SkippedTest{
				ID:     t.ID,
				Reason: fmt.Sprintf("Exceeds max execution time limit (%.0fms)", maxTimeMs),
			})
		}
	}
	return trimmed
}

func groupForParallel(tests []models.SelectedTest, maxGroups, maxPerGroup int) []models.TestGroup {
	if len(tests) == 0 {
		return nil
	}
	if maxGroups > len(tests) {
		maxGroups = len(tests)
	}
	if maxGroups <= 0 {
		maxGroups = 1
	}

	groups := make([]models.TestGroup, maxGroups)
	for i := range groups {
		groups[i] = models.TestGroup{
			GroupID:       fmt.Sprintf("group-%d", i),
			ParallelIndex: i,
		}
	}

	// Sort by duration descending for best-fit bin packing
	sorted := make([]models.SelectedTest, len(tests))
	copy(sorted, tests)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].EstimatedDuration > sorted[j].EstimatedDuration
	})

	for _, t := range sorted {
		// Find group with minimum duration that has room
		minIdx := 0
		for i := 1; i < len(groups); i++ {
			if len(groups[i].TestIDs) < maxPerGroup && groups[i].EstimatedDuration < groups[minIdx].EstimatedDuration {
				minIdx = i
			}
		}
		if len(groups[minIdx].TestIDs) >= maxPerGroup {
			continue
		}
		groups[minIdx].TestIDs = append(groups[minIdx].TestIDs, t.ID)
		groups[minIdx].EstimatedDuration += t.EstimatedDuration
	}

	// Remove empty groups
	var result []models.TestGroup
	for _, g := range groups {
		if len(g.TestIDs) > 0 {
			result = append(result, g)
		}
	}
	return result
}

func sumDurations(tests []models.SelectedTest) float64 {
	var total float64
	for _, t := range tests {
		total += t.EstimatedDuration
	}
	return total
}
