package service_test

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/test-execution-engine/models"
	"orion/platform-svc-go/internal/test-execution-engine/repository"
	"orion/platform-svc-go/internal/test-execution-engine/service"
)

// fakeTestExecRepo implements repository.RepositoryInterface for unit tests.
type fakeTestExecRepo struct {
	createReturn     *models.TestExecution
	createErr        error
	getReturn        *models.TestExecution
	getErr           error
	listReturn       *models.ExecutionListResponse
	listErr          error
	updateStatusErr  error
	submitResultsErr error
	getSuitesReturn  []models.TestSuite
	getSuitesErr     error
	getCasesReturn   []models.TestCase
	getCasesErr      error
}

var _ repository.RepositoryInterface = (*fakeTestExecRepo)(nil)

func (f *fakeTestExecRepo) Create(ctx context.Context, tenantID string, req *models.CreateExecutionRequest) (*models.TestExecution, error) {
	return f.createReturn, f.createErr
}

func (f *fakeTestExecRepo) Get(ctx context.Context, tenantID, id string) (*models.TestExecution, error) {
	return f.getReturn, f.getErr
}

func (f *fakeTestExecRepo) List(ctx context.Context, tenantID string, q models.ListExecutionsQuery) (*models.ExecutionListResponse, error) {
	return f.listReturn, f.listErr
}

func (f *fakeTestExecRepo) UpdateStatus(ctx context.Context, id string, status models.TestStatus) error {
	return f.updateStatusErr
}

func (f *fakeTestExecRepo) SubmitResults(ctx context.Context, id string, req *models.SubmitResultRequest) error {
	return f.submitResultsErr
}

func (f *fakeTestExecRepo) GetSuites(ctx context.Context, executionID string) ([]models.TestSuite, error) {
	return f.getSuitesReturn, f.getSuitesErr
}

func (f *fakeTestExecRepo) GetTestCases(ctx context.Context, suiteID string) ([]models.TestCase, error) {
	return f.getCasesReturn, f.getCasesErr
}

// --- helper to make a fake with a running execution ---
func pendingFake() *fakeTestExecRepo {
	return &fakeTestExecRepo{
		getReturn: &models.TestExecution{
			ID:     "exec-1",
			Status: models.TestStatusPending,
		},
	}
}

func runningFake() *fakeTestExecRepo {
	return &fakeTestExecRepo{
		getReturn: &models.TestExecution{
			ID:     "exec-1",
			Status: models.TestStatusRunning,
		},
	}
}

// =====================================================================
// NewService
// =====================================================================

func TestService_NewService(t *testing.T) {
	s := service.NewService(&fakeTestExecRepo{})
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

// =====================================================================
// Create
// =====================================================================

func TestService_Create_Success(t *testing.T) {
	ctx := context.Background()
	expected := &models.TestExecution{
		ID:        "exec-42",
		TenantID:  "tenant-1",
		Name:      "integration-test",
		Framework: models.FrameworkJUnit,
		Status:    models.TestStatusPending,
	}
	repo := &fakeTestExecRepo{createReturn: expected}
	s := service.NewService(repo)

	got, err := s.Create(ctx, "tenant-1", &models.CreateExecutionRequest{
		Name:      "integration-test",
		Framework: models.FrameworkJUnit,
	})
	if err != nil {
		t.Fatalf("Create returned unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("Create returned nil execution")
	}
	if got.ID != "exec-42" {
		t.Fatalf("Create: expected ID exec-42, got %s", got.ID)
	}
	if got.Name != "integration-test" {
		t.Fatalf("Create: expected Name integration-test, got %s", got.Name)
	}
}

func TestService_Create_MissingName(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{}
	s := service.NewService(repo)

	_, err := s.Create(ctx, "tenant-1", &models.CreateExecutionRequest{
		Framework: models.FrameworkJUnit,
	})
	if err == nil {
		t.Fatal("Create with empty Name should return an error")
	}
	if err.Error() != "name is required" {
		t.Fatalf("expected 'name is required', got %q", err.Error())
	}
}

func TestService_Create_MissingFramework(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{}
	s := service.NewService(repo)

	_, err := s.Create(ctx, "tenant-1", &models.CreateExecutionRequest{
		Name: "test-name",
	})
	if err == nil {
		t.Fatal("Create with empty Framework should return an error")
	}
	if err.Error() != "framework is required" {
		t.Fatalf("expected 'framework is required', got %q", err.Error())
	}
}

func TestService_Create_RepoError(t *testing.T) {
	ctx := context.Background()
	repoErr := errors.New("db connection lost")
	repo := &fakeTestExecRepo{createErr: repoErr}
	s := service.NewService(repo)

	_, err := s.Create(ctx, "tenant-1", &models.CreateExecutionRequest{
		Name:      "test",
		Framework: models.FrameworkPyTest,
	})
	if err == nil {
		t.Fatal("Create should propagate repo error")
	}
	if err.Error() != "db connection lost" {
		t.Fatalf("expected repo error propagated, got %q", err.Error())
	}
}

// =====================================================================
// Get
// =====================================================================

func TestService_Get_Success(t *testing.T) {
	ctx := context.Background()
	expected := &models.TestExecution{
		ID:        "exec-1",
		Name:      "unit-test",
		Framework: models.FrameworkGoTest,
		Status:    models.TestStatusPassed,
	}
	repo := &fakeTestExecRepo{getReturn: expected}
	s := service.NewService(repo)

	got, err := s.Get(ctx, "tenant-1", "exec-1")
	if err != nil {
		t.Fatalf("Get returned unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("Get returned nil execution")
	}
	if got.ID != "exec-1" {
		t.Fatalf("Get: expected ID exec-1, got %s", got.ID)
	}
	if got.Name != "unit-test" {
		t.Fatalf("Get: expected Name unit-test, got %s", got.Name)
	}
	if got.Status != models.TestStatusPassed {
		t.Fatalf("Get: expected status passed, got %s", got.Status)
	}
}

func TestService_Get_NotFound(t *testing.T) {
	ctx := context.Background()
	notFoundErr := errors.New("not found")
	repo := &fakeTestExecRepo{getErr: notFoundErr}
	s := service.NewService(repo)

	_, err := s.Get(ctx, "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("Get should return error when execution not found")
	}
}

// =====================================================================
// List
// =====================================================================

func TestService_List_Success(t *testing.T) {
	ctx := context.Background()
	expected := &models.ExecutionListResponse{
		Items: []models.TestExecution{
			{ID: "e1", Name: "test-1"},
			{ID: "e2", Name: "test-2"},
		},
		Total:    2,
		Page:     1,
		PageSize: 20,
	}
	repo := &fakeTestExecRepo{listReturn: expected}
	s := service.NewService(repo)

	q := models.ListExecutionsQuery{Page: 1, PageSize: 20}
	got, err := s.List(ctx, "tenant-1", q)
	if err != nil {
		t.Fatalf("List returned unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("List returned nil response")
	}
	if got.Total != 2 {
		t.Fatalf("List: expected Total 2, got %d", got.Total)
	}
	if len(got.Items) != 2 {
		t.Fatalf("List: expected 2 items, got %d", len(got.Items))
	}
}

func TestService_List_RepoError(t *testing.T) {
	ctx := context.Background()
	repoErr := errors.New("query timeout")
	repo := &fakeTestExecRepo{listErr: repoErr}
	s := service.NewService(repo)

	q := models.ListExecutionsQuery{Page: 1, PageSize: 10}
	_, err := s.List(ctx, "tenant-1", q)
	if err == nil {
		t.Fatal("List should propagate repo error")
	}
}

// =====================================================================
// SubmitResults
// =====================================================================

func TestService_SubmitResults_Success(t *testing.T) {
	ctx := context.Background()
	repo := runningFake()
	s := service.NewService(repo)

	err := s.SubmitResults(ctx, "tenant-1", "exec-1", &models.SubmitResultRequest{
		Framework:  models.FrameworkJUnit,
		TotalTests: 10,
		Passed:     8,
		Failed:     2,
	})
	if err != nil {
		t.Fatalf("SubmitResults returned unexpected error: %v", err)
	}
}

func TestService_SubmitResults_FromPending(t *testing.T) {
	ctx := context.Background()
	repo := pendingFake()
	s := service.NewService(repo)

	err := s.SubmitResults(ctx, "tenant-1", "exec-1", &models.SubmitResultRequest{
		Framework:  models.FrameworkPyTest,
		TotalTests: 5,
		Passed:     5,
	})
	if err != nil {
		t.Fatalf("SubmitResults from pending should succeed: %v", err)
	}
}

func TestService_SubmitResults_NotRunningOrPending(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{
		getReturn: &models.TestExecution{
			ID:     "exec-1",
			Status: models.TestStatusPassed,
		},
	}
	s := service.NewService(repo)

	err := s.SubmitResults(ctx, "tenant-1", "exec-1", &models.SubmitResultRequest{
		Framework:  models.FrameworkJUnit,
		TotalTests: 10,
	})
	if err == nil {
		t.Fatal("SubmitResults on completed execution should fail")
	}
}

func TestService_SubmitResults_GetError(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{getErr: errors.New("not found")}
	s := service.NewService(repo)

	err := s.SubmitResults(ctx, "tenant-1", "nope", &models.SubmitResultRequest{
		Framework:  models.FrameworkJUnit,
		TotalTests: 1,
	})
	if err == nil {
		t.Fatal("SubmitResults should propagate Get error")
	}
}

// =====================================================================
// Start
// =====================================================================

func TestService_Start_Success(t *testing.T) {
	ctx := context.Background()
	repo := pendingFake()
	s := service.NewService(repo)

	err := s.Start(ctx, "tenant-1", "exec-1")
	if err != nil {
		t.Fatalf("Start returned unexpected error: %v", err)
	}
}

func TestService_Start_NotPending(t *testing.T) {
	ctx := context.Background()
	repo := runningFake()
	s := service.NewService(repo)

	err := s.Start(ctx, "tenant-1", "exec-1")
	if err == nil {
		t.Fatal("Start on non-pending execution should fail")
	}
}

func TestService_Start_GetError(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{getErr: errors.New("missing")}
	s := service.NewService(repo)

	err := s.Start(ctx, "tenant-1", "nope")
	if err == nil {
		t.Fatal("Start should propagate Get error")
	}
}

// =====================================================================
// Cancel
// =====================================================================

func TestService_Cancel_Success(t *testing.T) {
	ctx := context.Background()
	repo := runningFake()
	s := service.NewService(repo)

	err := s.Cancel(ctx, "tenant-1", "exec-1")
	if err != nil {
		t.Fatalf("Cancel returned unexpected error: %v", err)
	}
}

func TestService_Cancel_AlreadyPassed(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{
		getReturn: &models.TestExecution{
			ID:     "exec-1",
			Status: models.TestStatusPassed,
		},
	}
	s := service.NewService(repo)

	err := s.Cancel(ctx, "tenant-1", "exec-1")
	if err == nil {
		t.Fatal("Cancel on passed execution should fail")
	}
}

func TestService_Cancel_AlreadyFailed(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{
		getReturn: &models.TestExecution{
			ID:     "exec-1",
			Status: models.TestStatusFailed,
		},
	}
	s := service.NewService(repo)

	err := s.Cancel(ctx, "tenant-1", "exec-1")
	if err == nil {
		t.Fatal("Cancel on failed execution should fail")
	}
}

// =====================================================================
// GetSuites
// =====================================================================

func TestService_GetSuites_Success(t *testing.T) {
	ctx := context.Background()
	expectedSuites := []models.TestSuite{
		{ID: "suite-1", Name: "auth-tests", Tests: 3},
		{ID: "suite-2", Name: "api-tests", Tests: 5},
	}
	repo := &fakeTestExecRepo{getSuitesReturn: expectedSuites}
	s := service.NewService(repo)

	suites, err := s.GetSuites(ctx, "exec-1")
	if err != nil {
		t.Fatalf("GetSuites returned unexpected error: %v", err)
	}
	if len(suites) != 2 {
		t.Fatalf("GetSuites: expected 2 suites, got %d", len(suites))
	}
}

func TestService_GetSuites_Empty(t *testing.T) {
	ctx := context.Background()
	repo := &fakeTestExecRepo{getSuitesReturn: []models.TestSuite{}}
	s := service.NewService(repo)

	suites, err := s.GetSuites(ctx, "exec-1")
	if err != nil {
		t.Fatalf("GetSuites returned unexpected error: %v", err)
	}
	if suites == nil {
		t.Fatal("GetSuites should return empty slice, not nil")
	}
}

// =====================================================================
// GetTestCases
// =====================================================================

func TestService_GetTestCases_Success(t *testing.T) {
	ctx := context.Background()
	expected := []models.TestCase{
		{ID: "tc-1", Name: "test-login", Status: models.TestStatusPassed},
	}
	repo := &fakeTestExecRepo{getCasesReturn: expected}
	s := service.NewService(repo)

	cases, err := s.GetTestCases(ctx, "suite-1")
	if err != nil {
		t.Fatalf("GetTestCases returned unexpected error: %v", err)
	}
	if len(cases) != 1 {
		t.Fatalf("GetTestCases: expected 1 case, got %d", len(cases))
	}
	if cases[0].Name != "test-login" {
		t.Fatalf("GetTestCases: expected name test-login, got %s", cases[0].Name)
	}
}

func TestService_GetTestCases_RepoError(t *testing.T) {
	ctx := context.Background()
	repoErr := errors.New("db error")
	repo := &fakeTestExecRepo{getCasesErr: repoErr}
	s := service.NewService(repo)

	_, err := s.GetTestCases(ctx, "suite-1")
	if err == nil {
		t.Fatal("GetTestCases should propagate repo error")
	}
}
