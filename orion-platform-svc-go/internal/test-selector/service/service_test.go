package service

import (
	"context"
	"database/sql"
	"testing"

	"orion/platform-svc-go/internal/test-selector/models"
)

type mockTestSelectorRepo struct {
	plan   *models.TestExecutionPlan
	result *models.PRTestResult
	suites map[string]*models.TestSuite
	dbErr  error
}

func newMockTSRepo() *mockTestSelectorRepo {
	return &mockTestSelectorRepo{suites: map[string]*models.TestSuite{}}
}

func (m *mockTestSelectorRepo) CreatePRTestResult(_ context.Context, res *models.PRTestResult) error {
	m.result = res
	return nil
}

func (m *mockTestSelectorRepo) GetPRTestResultByPlanID(_ context.Context, tenantID, planID string) (*models.PRTestResult, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return m.result, nil
}

func (m *mockTestSelectorRepo) GetPRTestResultByPRID(_ context.Context, tenantID, prID string) (*models.PRTestResult, error) {
	if m.result == nil {
		return nil, sql.ErrNoRows
	}
	return m.result, nil
}

func (m *mockTestSelectorRepo) UpdatePRTestStatus(_ context.Context, tenantID, prID string, status models.TestStatus) error {
	return nil
}

func (m *mockTestSelectorRepo) CreateTestSuite(_ context.Context, s *models.TestSuite) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if s.ID == "" {
		s.ID = s.TenantID + ":" + s.Name
	}
	m.suites[s.ID] = s
	return nil
}

func (m *mockTestSelectorRepo) ListTestSuites(_ context.Context, tenantID string) ([]models.TestSuite, error) {
	var out []models.TestSuite
	for _, s := range m.suites {
		if s.TenantID == tenantID {
			out = append(out, *s)
		}
	}
	return out, nil
}

func (m *mockTestSelectorRepo) DeleteTestSuite(_ context.Context, tenantID, id string) error {
	_, ok := m.suites[id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.suites, id)
	return nil
}

func (m *mockTestSelectorRepo) DeleteTestSuitesByTenant(_ context.Context, tenantID string) error {
	return nil
}

func (m *mockTestSelectorRepo) CreateTestCase(_ context.Context, c *models.TestCase) error {
	return nil
}

func (m *mockTestSelectorRepo) ListTestCases(_ context.Context, tenantID string) ([]models.TestCase, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) ListTestCasesBySuite(_ context.Context, tenantID, suiteID string) ([]models.TestCase, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) ListTestCasesByFlakyScore(_ context.Context, tenantID string, threshold float64) ([]models.TestCase, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) DeleteTestCasesByTenant(_ context.Context, tenantID string) error {
	return nil
}

func (m *mockTestSelectorRepo) CreateTestExecutionRecord(_ context.Context, rec *models.TestExecutionRecord) error {
	return nil
}

func (m *mockTestSelectorRepo) GetTestHistory(_ context.Context, tenantID, testID string) ([]models.TestExecutionRecord, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) GetTestStats(_ context.Context, tenantID, testID string) (*models.TestHistoryStats, error) {
	return &models.TestHistoryStats{}, nil
}

func (m *mockTestSelectorRepo) GetAllTestStats(_ context.Context, tenantID string) ([]*models.TestHistoryStats, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) GetFlakyTests(_ context.Context, tenantID string, threshold float64) ([]string, error) {
	return []string{}, nil
}

func (m *mockTestSelectorRepo) DeleteExecutionHistoryByTenant(_ context.Context, tenantID string) error {
	return nil
}

func (m *mockTestSelectorRepo) DeleteCodeMappingsByTenant(_ context.Context, tenantID string) error {
	return nil
}

func (m *mockTestSelectorRepo) GetTestsForSourceFile(_ context.Context, tenantID, sourceFile string) ([]string, error) {
	return nil, nil
}

func (m *mockTestSelectorRepo) GetCoverageStats(_ context.Context, tenantID string) (models.CoverageStats, error) {
	return models.CoverageStats{
		"src/main.go": models.CoverageEntry{TestCount: 1, TestIDs: []string{"test1"}},
	}, nil
}

func TestSelectTestsForPR(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	plan, err := svc.SelectTestsForPR(ctx, "t1", models.PRChange{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if plan == nil {
		t.Fatal("expected non-nil plan")
	}
}

func TestGetTestPlan(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	repo.result = &models.PRTestResult{
		PRID:     "p1",
		PlanData: `{"planId":"p1","selectedTests":[]}`,
	}
	svc := &Service{repo: repo}

	plan, err := svc.GetTestPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if plan == nil {
		t.Fatal("expected non-nil plan")
	}
}

func TestCreateTestSuite_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	suite, err := svc.CreateTestSuite(ctx, "t1", models.CreateTestSuiteRequest{Name: "suite1"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if suite.Name != "suite1" {
		t.Errorf("expected 'suite1', got %q", suite.Name)
	}
}

func TestListTestSuites_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	// Seed the mock directly since CreateTestSuite is a stub
	_ = repo.CreateTestSuite(ctx, &models.TestSuite{ID: "t1:s1", TenantID: "t1", Name: "s1"})
	_ = repo.CreateTestSuite(ctx, &models.TestSuite{ID: "t1:s2", TenantID: "t1", Name: "s2"})

	suites, err := svc.ListTestSuites(ctx, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(suites) != 2 {
		t.Errorf("expected 2 suites, got %d", len(suites))
	}
}

func TestDeleteTestSuite_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	_ = repo.CreateTestSuite(ctx, &models.TestSuite{ID: "t1:s1", TenantID: "t1", Name: "s1"})

	err := svc.DeleteTestSuite(ctx, "t1", "t1:s1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	suites, _ := svc.ListTestSuites(ctx, "t1")
	if len(suites) != 0 {
		t.Error("expected empty suite list")
	}
}

func TestGetFlakyTests_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	flaky, _, err := svc.GetFlakyTests(ctx, "t1", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if flaky == nil {
		t.Fatal("expected non-nil flaky tests")
	}
}

func TestGetCoverage_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	stats, err := svc.GetCoverage(ctx, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(stats) == 0 {
		t.Fatal("expected coverage stats")
	}
}

func TestRecordTestResult_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockTSRepo()
	svc := &Service{repo: repo}

	err := svc.RecordTestResult(ctx, "t1", models.RecordTestResultRequest{
		TestID:   "test1",
		Passed:   true,
		Duration: 100,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}
