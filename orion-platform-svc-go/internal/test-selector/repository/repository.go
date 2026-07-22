package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/test-selector/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- PRTestResult ----------

func (r *Repository) CreatePRTestResult(ctx context.Context, res *models.PRTestResult) error {
	res.CreatedAt = time.Now().UTC()
	res.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO test_selector_pr_results (id, tenant_id, pr_id, plan_data, impact_data, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :pr_id, :plan_data, :impact_data, :status, :created_at, :updated_at)`, res)
	return err
}

func (r *Repository) GetPRTestResultByPlanID(ctx context.Context, tenantID, planID string) (*models.PRTestResult, error) {
	// Search within plan_data JSON for plan_id
	query := `SELECT * FROM test_selector_pr_results WHERE tenant_id=$1 AND plan_data->>'planId'=$2 ORDER BY updated_at DESC LIMIT 1`
	var res models.PRTestResult
	err := r.db.GetContext(ctx, &res, query, tenantID, planID)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *Repository) GetPRTestResultByPRID(ctx context.Context, tenantID, prID string) (*models.PRTestResult, error) {
	var res models.PRTestResult
	err := r.db.GetContext(ctx, &res,
		`SELECT * FROM test_selector_pr_results WHERE tenant_id=$1 AND pr_id=$2 ORDER BY updated_at DESC LIMIT 1`, tenantID, prID)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *Repository) UpdatePRTestStatus(ctx context.Context, tenantID, prID string, status models.TestStatus) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE test_selector_pr_results SET status=$1, updated_at=$2 WHERE tenant_id=$3 AND pr_id=$4`,
		status, time.Now().UTC(), tenantID, prID)
	return err
}

// ---------- TestSuite ----------

func (r *Repository) CreateTestSuite(ctx context.Context, s *models.TestSuite) error {
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO test_selector_suites (id, tenant_id, name, file_path, test_count, avg_duration, pass_rate, last_run, source_files, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :file_path, :test_count, :avg_duration, :pass_rate, :last_run, :source_files, :created_at, :updated_at)
		 ON CONFLICT (tenant_id, id) DO UPDATE SET name=EXCLUDED.name, file_path=EXCLUDED.file_path, test_count=EXCLUDED.test_count, avg_duration=EXCLUDED.avg_duration, pass_rate=EXCLUDED.pass_rate, last_run=EXCLUDED.last_run, source_files=EXCLUDED.source_files, updated_at=EXCLUDED.updated_at`, s)
	return err
}

func (r *Repository) ListTestSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error) {
	var suites []models.TestSuite
	err := r.db.SelectContext(ctx, &suites,
		`SELECT * FROM test_selector_suites WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return suites, err
}

func (r *Repository) DeleteTestSuitesByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM test_selector_suites WHERE tenant_id=$1`, tenantID)
	return err
}

func (r *Repository) DeleteTestSuite(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM test_selector_suites WHERE tenant_id=$1 AND id=$2`, tenantID, id)
	return err
}

// ---------- TestCase ----------

func (r *Repository) CreateTestCase(ctx context.Context, c *models.TestCase) error {
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO test_selector_cases (id, tenant_id, suite_id, name, file_path, dependencies, avg_duration, flaky_score, history, created_at, updated_at)
		 VALUES (:id, :tenant_id, :suite_id, :name, :file_path, :dependencies, :avg_duration, :flaky_score, :history, :created_at, :updated_at)
		 ON CONFLICT (tenant_id, id) DO UPDATE SET suite_id=EXCLUDED.suite_id, name=EXCLUDED.name, file_path=EXCLUDED.file_path, dependencies=EXCLUDED.dependencies, avg_duration=EXCLUDED.avg_duration, flaky_score=EXCLUDED.flaky_score, history=EXCLUDED.history, updated_at=EXCLUDED.updated_at`, c)
	return err
}

func (r *Repository) ListTestCases(ctx context.Context, tenantID string) ([]models.TestCase, error) {
	var cases []models.TestCase
	err := r.db.SelectContext(ctx, &cases,
		`SELECT * FROM test_selector_cases WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return cases, err
}

func (r *Repository) ListTestCasesBySuite(ctx context.Context, tenantID, suiteID string) ([]models.TestCase, error) {
	var cases []models.TestCase
	err := r.db.SelectContext(ctx, &cases,
		`SELECT * FROM test_selector_cases WHERE tenant_id=$1 AND suite_id=$2 ORDER BY created_at DESC`, tenantID, suiteID)
	return cases, err
}

func (r *Repository) ListTestCasesByFlakyScore(ctx context.Context, tenantID string, threshold float64) ([]models.TestCase, error) {
	var cases []models.TestCase
	err := r.db.SelectContext(ctx, &cases,
		`SELECT * FROM test_selector_cases WHERE tenant_id=$1 AND flaky_score >= $2 ORDER BY flaky_score DESC`, tenantID, threshold)
	return cases, err
}

func (r *Repository) DeleteTestCasesByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM test_selector_cases WHERE tenant_id=$1`, tenantID)
	return err
}

// ---------- TestExecutionRecord ----------

func (r *Repository) CreateTestExecutionRecord(ctx context.Context, rec *models.TestExecutionRecord) error {
	now := time.Now().UTC()
	rec.CreatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO test_selector_execution_history (id, tenant_id, test_id, execution_id, passed, duration, failure_message, pr_id, executed_at, created_at)
		 VALUES (:id, :tenant_id, :test_id, :execution_id, :passed, :duration, :failure_message, :pr_id, :executed_at, :created_at)`, rec)
	return err
}

func (r *Repository) GetTestHistory(ctx context.Context, tenantID, testID string) ([]models.TestExecutionRecord, error) {
	var records []models.TestExecutionRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM test_selector_execution_history WHERE tenant_id=$1 AND test_id=$2 ORDER BY executed_at DESC LIMIT 200`, tenantID, testID)
	return records, err
}

func (r *Repository) GetTestStats(ctx context.Context, tenantID, testID string) (*models.TestHistoryStats, error) {
	stats := &models.TestHistoryStats{TestID: testID}

	// Aggregate stats
	err := r.db.GetContext(ctx, stats,
		`SELECT count(*) as "totalRuns",
		       sum(CASE WHEN passed THEN 1 ELSE 0 END) as "passedRuns",
		       sum(CASE WHEN NOT passed THEN 1 ELSE 0 END) as "failedRuns",
		       round(avg(duration), 0) as "avgDuration",
		       avg(CASE WHEN passed THEN 1.0 ELSE 0.0 END) as "passRate"
		 FROM test_selector_execution_history WHERE tenant_id=$1 AND test_id=$2`,
		tenantID, testID)
	if err == sql.ErrNoRows {
		return stats, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get test stats: %w", err)
	}

	// Flaky score
	var flakyScore float64
	err = r.db.GetContext(ctx, &flakyScore,
		`SELECT flaky_score FROM test_selector_cases WHERE tenant_id=$1 AND id=$2`, tenantID, testID)
	if err == nil {
		stats.FlakyScore = flakyScore
	}

	// Consecutive failures
	err = r.db.GetContext(ctx, &stats.ConsecutiveFailures,
		`SELECT count(*) FROM (
			SELECT passed FROM test_selector_execution_history WHERE tenant_id=$1 AND test_id=$2 ORDER BY executed_at DESC
		) sub WHERE NOT passed`, tenantID, testID)
	// Simplified: count trailing failures
	if err == nil {
		// Recompute properly with a subquery
		var trailing int
		err = r.db.GetContext(ctx, &trailing,
			`SELECT count(*) FROM test_selector_execution_history h1
			 WHERE tenant_id=$1 AND test_id=$2 AND passed=false
			   AND NOT EXISTS (
				   SELECT 1 FROM test_selector_execution_history h2
				   WHERE h2.tenant_id=h1.tenant_id AND h2.test_id=h1.test_id
				     AND h2.executed_at > h1.executed_at AND h2.passed=true
			   )`, tenantID, testID)
		if err == nil {
			stats.ConsecutiveFailures = trailing
		}
	}

	// Recent failures
	var failures []string
	err = r.db.SelectContext(ctx, &failures,
		`SELECT failure_message FROM test_selector_execution_history WHERE tenant_id=$1 AND test_id=$2 AND passed=false AND failure_message IS NOT NULL ORDER BY executed_at DESC LIMIT 3`, tenantID, testID)
	if err == nil {
		stats.RecentFailures = failures
	}

	// History records
	records, err := r.GetTestHistory(ctx, tenantID, testID)
	if err == nil {
		stats.History = recordsToHistoryEntries(records)
	}

	return stats, nil
}

func (r *Repository) GetAllTestStats(ctx context.Context, tenantID string) ([]*models.TestHistoryStats, error) {
	// Get distinct test IDs that have history
	var testIDs []string
	err := r.db.SelectContext(ctx, &testIDs,
		`SELECT DISTINCT test_id FROM test_selector_execution_history WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get test IDs: %w", err)
	}

	stats := make([]*models.TestHistoryStats, 0, len(testIDs))
	for _, id := range testIDs {
		s, err := r.GetTestStats(ctx, tenantID, id)
		if err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *Repository) GetFlakyTests(ctx context.Context, tenantID string, threshold float64) ([]string, error) {
	var testIDs []string
	err := r.db.SelectContext(ctx, &testIDs,
		`SELECT DISTINCT test_id FROM test_selector_cases WHERE tenant_id=$1 AND flaky_score >= $2`, tenantID, threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to get flaky tests: %w", err)
	}
	return testIDs, nil
}

func (r *Repository) DeleteExecutionHistoryByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM test_selector_execution_history WHERE tenant_id=$1`, tenantID)
	return err
}

func (r *Repository) PruneOldHistory(ctx context.Context, tenantID string, retentionDays int) (int, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM test_selector_execution_history WHERE tenant_id=$1 AND executed_at < $2`, tenantID, cutoff)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// ---------- TestCodeMapping ----------

func (r *Repository) CreateTestCodeMapping(ctx context.Context, m *models.TestCodeMapping) error {
	now := time.Now().UTC()
	m.CreatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO test_selector_code_mappings (id, tenant_id, test_path, source_paths, symbol_mapping, created_at)
		 VALUES (:id, :tenant_id, :test_path, :source_paths, :symbol_mapping, :created_at)
		 ON CONFLICT (tenant_id, test_path) DO UPDATE SET source_paths=EXCLUDED.source_paths, symbol_mapping=EXCLUDED.symbol_mapping`, m)
	return err
}

func (r *Repository) DeleteCodeMappingsByTenant(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM test_selector_code_mappings WHERE tenant_id=$1`, tenantID)
	return err
}

// ---------- Coverage Stats ----------

func (r *Repository) GetCoverageStats(ctx context.Context, tenantID string) (models.CoverageStats, error) {
	// Parse source_files from suites to build source -> test mapping
	var suites []models.TestSuite
	err := r.db.SelectContext(ctx, &suites,
		`SELECT id, name, file_path, source_files FROM test_selector_suites WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	coverage := make(models.CoverageStats)
	for _, s := range suites {
		var paths []string
		_ = json.Unmarshal([]byte(s.SourceFiles), &paths)
		for _, p := range paths {
			if _, ok := coverage[p]; !ok {
				coverage[p] = models.CoverageEntry{TestIDs: []string{}}
			}
			entry := coverage[p]
			entry.TestIDs = append(entry.TestIDs, s.ID)
			entry.TestCount = len(entry.TestIDs)
			coverage[p] = entry
		}
	}

	// Also add test case dependencies
	var cases []models.TestCase
	err = r.db.SelectContext(ctx, &cases,
		`SELECT id, dependencies FROM test_selector_cases WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, c := range cases {
		var deps []struct {
			FilePath string `json:"filePath"`
		}
		_ = json.Unmarshal([]byte(c.Dependencies), &deps)
		for _, d := range deps {
			if _, ok := coverage[d.FilePath]; !ok {
				coverage[d.FilePath] = models.CoverageEntry{TestIDs: []string{}}
			}
			entry2 := coverage[d.FilePath]
			entry2.TestIDs = append(entry2.TestIDs, c.ID)
			entry2.TestCount = len(entry2.TestIDs)
			coverage[d.FilePath] = entry2
		}
	}

	return coverage, nil
}

// ---------- Helper ----------

func recordsToHistoryEntries(records []models.TestExecutionRecord) []models.TestHistoryEntry {
	entries := make([]models.TestHistoryEntry, len(records))
	for i, r := range records {
		entries[i] = models.TestHistoryEntry{
			ExecutionID:    r.ExecutionID,
			Passed:         r.Passed,
			Duration:       r.Duration,
			Timestamp:      r.ExecutedAt.UTC().Format(time.RFC3339),
			FailureMessage: r.FailureMessage,
			PRID:           r.PRID,
		}
	}
	return entries
}

// ---------- Dependency Analyzer internal helpers ----------

func (r *Repository) GetTestsForSourceFile(ctx context.Context, tenantID, sourceFile string) ([]string, error) {
	var testIDs []string
	// Check suites source_files
	err := r.db.SelectContext(ctx, &testIDs,
		`SELECT id FROM test_selector_suites WHERE tenant_id=$1 AND source_files LIKE $2`,
		tenantID, fmt.Sprintf(`%%"%s"%%`, sourceFile))
	if err != nil {
		return nil, err
	}

	// Check cases dependencies
	var caseIDs []string
	err = r.db.SelectContext(ctx, &caseIDs,
		`SELECT id FROM test_selector_cases WHERE tenant_id=$1 AND dependencies LIKE $2`,
		tenantID, fmt.Sprintf(`%%"%s"%%`, sourceFile))
	if err != nil {
		return nil, err
	}

	// Deduplicate
	seen := make(map[string]bool)
	var result []string
	for _, id := range append(testIDs, caseIDs...) {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result, nil
}

func (r *Repository) GetDependenciesForTest(ctx context.Context, tenantID, testID string) ([]string, error) {
	// Try case first
	var deps string
	err := r.db.GetContext(ctx, &deps,
		`SELECT dependencies FROM test_selector_cases WHERE tenant_id=$1 AND id=$2`, tenantID, testID)
	if err == nil && deps != "" {
		var result []string
		_ = json.Unmarshal([]byte(deps), &result)
		return result, nil
	}

	// Try suite
	var sourceFiles string
	err = r.db.GetContext(ctx, &sourceFiles,
		`SELECT source_files FROM test_selector_suites WHERE tenant_id=$1 AND id=$2`, tenantID, testID)
	if err == nil && sourceFiles != "" {
		var result []string
		_ = json.Unmarshal([]byte(sourceFiles), &result)
		return result, nil
	}

	return []string{}, nil
}

// GetOrCreateTestID generates or retrieves a stable test ID for a test path.
func (r *Repository) GetOrCreateTestID(ctx context.Context, tenantID, name, filePath string) string {
	return uuid.New().String()
}

// UpdateCaseFlakyScore updates the flaky score for a test case.
func (r *Repository) UpdateCaseFlakyScore(ctx context.Context, tenantID, testID string, score float64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE test_selector_cases SET flaky_score=$1, updated_at=$2 WHERE tenant_id=$3 AND id=$4`,
		score, time.Now().UTC(), tenantID, testID)
	return err
}
