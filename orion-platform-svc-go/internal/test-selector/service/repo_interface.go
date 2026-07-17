package service

import (
	"context"

	"orion/platform-svc-go/internal/test-selector/models"
)

// TestSelectorRepo abstracts the repository interface used by Service.
type TestSelectorRepo interface {
	// PRTestResult
	CreatePRTestResult(ctx context.Context, res *models.PRTestResult) error
	GetPRTestResultByPlanID(ctx context.Context, tenantID, planID string) (*models.PRTestResult, error)
	GetPRTestResultByPRID(ctx context.Context, tenantID, prID string) (*models.PRTestResult, error)
	UpdatePRTestStatus(ctx context.Context, tenantID, prID string, status models.TestStatus) error

	// TestSuite
	CreateTestSuite(ctx context.Context, s *models.TestSuite) error
	ListTestSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error)
	DeleteTestSuite(ctx context.Context, tenantID, id string) error
	DeleteTestSuitesByTenant(ctx context.Context, tenantID string) error

	// TestCase
	CreateTestCase(ctx context.Context, c *models.TestCase) error
	ListTestCases(ctx context.Context, tenantID string) ([]models.TestCase, error)
	ListTestCasesBySuite(ctx context.Context, tenantID, suiteID string) ([]models.TestCase, error)
	ListTestCasesByFlakyScore(ctx context.Context, tenantID string, threshold float64) ([]models.TestCase, error)
	DeleteTestCasesByTenant(ctx context.Context, tenantID string) error

	// TestExecutionRecord / History / Stats
	CreateTestExecutionRecord(ctx context.Context, rec *models.TestExecutionRecord) error
	GetTestHistory(ctx context.Context, tenantID, testID string) ([]models.TestExecutionRecord, error)
	GetTestStats(ctx context.Context, tenantID, testID string) (*models.TestHistoryStats, error)
	GetAllTestStats(ctx context.Context, tenantID string) ([]*models.TestHistoryStats, error)
	GetFlakyTests(ctx context.Context, tenantID string, threshold float64) ([]string, error)
	DeleteExecutionHistoryByTenant(ctx context.Context, tenantID string) error

	// CodeMapping
	GetTestsForSourceFile(ctx context.Context, tenantID, sourceFile string) ([]string, error)
	DeleteCodeMappingsByTenant(ctx context.Context, tenantID string) error

	// Coverage
	GetCoverageStats(ctx context.Context, tenantID string) (models.CoverageStats, error)
}
