package service_test

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/sandbox/models"
	"orion/platform-svc-go/internal/sandbox/service"
)

// -----------------------------------------------------------------------------
// Fake repository
// -----------------------------------------------------------------------------

var repoErr = errors.New("repo error")

type fakeSandboxRepo struct {
	stub struct {
		createErr error
		getErr    error
		listErr   error
		deleteErr error
		getJob    *models.SandboxJob
		listJobs  []models.SandboxJob
		// Capture last arguments so tests can verify wiring
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}
}

func (r *fakeSandboxRepo) Create(_ context.Context, m *models.SandboxJob) error {
	r.stub.createJob = m
	return r.stub.createErr
}

func (r *fakeSandboxRepo) GetByID(_ context.Context, tenantID, id string) (*models.SandboxJob, error) {
	r.stub.getTenant = tenantID
	r.stub.getID = id
	if r.stub.getErr != nil {
		return nil, r.stub.getErr
	}
	return r.stub.getJob, nil
}

func (r *fakeSandboxRepo) List(_ context.Context, tenantID, status string) ([]models.SandboxJob, error) {
	r.stub.listStatus = status
	if r.stub.listErr != nil {
		return nil, r.stub.listErr
	}
	return r.stub.listJobs, nil
}

func (r *fakeSandboxRepo) Update(_ context.Context, tenantID, id string, updates map[string]interface{}) (*models.SandboxJob, error) {
	return r.stub.getJob, nil
}

func (r *fakeSandboxRepo) Delete(_ context.Context, tenantID, id string) error {
	r.stub.deleteTenant = tenantID
	r.stub.deleteID = id
	return r.stub.deleteErr
}

var _ service.RepositoryInterface = (*fakeSandboxRepo)(nil)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

func newTestService(repo *fakeSandboxRepo) *service.Service {
	logger := zap.NewNop()
	return service.NewService(repo, logger)
}

func boolPtr(b bool) *bool        { return &b }
func floatPtr(f float64) *float64 { return &f }
func uintPtr(u uint64) *uint64    { return &u }
func int64Ptr(i int64) *int64     { return &i }

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	logger := zap.NewNop()
	s := service.NewService(&fakeSandboxRepo{}, logger)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewService_NilRepo(t *testing.T) {
	logger := zap.NewNop()
	var nilRepo service.RepositoryInterface
	s := service.NewService(nilRepo, logger)
	if s == nil {
		t.Fatal("NewService with nil repo should still return a non-nil service")
	}
	// Calling CreateJob delegates to the nil repo, which panics (nil interface call).
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic when calling CreateJob with nil repo")
		}
	}()
	s.CreateJob(context.Background(), "t1", models.CreateSandboxJobRequest{
		Code: "x", Language: "python",
	})
}

// ---- CreateJob ----

func TestCreateJob_Success(t *testing.T) {
	repo := &fakeSandboxRepo{}
	svc := newTestService(repo)

	req := models.CreateSandboxJobRequest{
		Code:     "print('hello')",
		Language: "python",
	}
	job, err := svc.CreateJob(context.Background(), "tenant1", req)

	if err != nil {
		t.Fatalf("CreateJob unexpected error: %v", err)
	}
	if job == nil {
		t.Fatal("CreateJob returned nil job")
	}
	if job.TenantID != "tenant1" {
		t.Errorf("TenantID = %s, want tenant1", job.TenantID)
	}
	if job.Code != "print('hello')" {
		t.Errorf("Code = %s", job.Code)
	}
	if job.Language != "python" {
		t.Errorf("Language = %s", job.Language)
	}

	// Verify the repo received the same values
	captured := repo.stub.createJob
	if captured == nil {
		t.Fatal("repo.Create was not called")
	}
	if captured.TenantID != "tenant1" || captured.Code != "print('hello')" || captured.Language != "python" {
		t.Fatalf("repo.Create received wrong job: %+v", captured)
	}
}

func TestCreateJob_WithOverrides(t *testing.T) {
	repo := &fakeSandboxRepo{}
	svc := newTestService(repo)

	maxCPU := floatPtr(2.5)
	maxMem := uintPtr(256 * 1024 * 1024)
	timeout := int64Ptr(60)
	network := boolPtr(true)
	fileAccess := boolPtr(true)

	req := models.CreateSandboxJobRequest{
		Code:       "print('hi')",
		Language:   "bash",
		MaxCPU:     maxCPU,
		MaxMemory:  maxMem,
		TimeoutSec: timeout,
		Network:    network,
		FileAccess: fileAccess,
	}
	job, err := svc.CreateJob(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("CreateJob unexpected error: %v", err)
	}
	if job.MaxCPU != 2.5 {
		t.Errorf("MaxCPU = %f, want 2.5", job.MaxCPU)
	}
	if job.MaxMemory != 256*1024*1024 {
		t.Errorf("MaxMemory = %d", job.MaxMemory)
	}
	if job.TimeoutSec != 60 {
		t.Errorf("TimeoutSec = %d, want 60", job.TimeoutSec)
	}
	if !job.Network {
		t.Error("Network = false, want true")
	}
	if !job.FileAccess {
		t.Error("FileAccess = false, want true")
	}
}

func TestCreateJob_RepoError(t *testing.T) {
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{createErr: repoErr}}
	svc := newTestService(repo)

	_, err := svc.CreateJob(context.Background(), "t1", models.CreateSandboxJobRequest{
		Code: "x", Language: "python",
	})
	if !errors.Is(err, repoErr) {
		t.Fatalf("CreateJob error = %v, want repoErr", err)
	}
}

// ---- GetJob ----

func TestGetJob_Found(t *testing.T) {
	expected := &models.SandboxJob{ID: "j1", TenantID: "t1", Status: models.JobStatusPending}
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{getJob: expected}}
	svc := newTestService(repo)

	job, err := svc.GetJob(context.Background(), "t1", "j1")
	if err != nil {
		t.Fatalf("GetJob unexpected error: %v", err)
	}
	if job.ID != "j1" {
		t.Errorf("job.ID = %s", job.ID)
	}
	if repo.stub.getTenant != "t1" {
		t.Errorf("getTenant = %s", repo.stub.getTenant)
	}
	if repo.stub.getID != "j1" {
		t.Errorf("getID = %s", repo.stub.getID)
	}
}

func TestGetJob_NotFound(t *testing.T) {
	repo := &fakeSandboxRepo{}
	svc := newTestService(repo)

	job, err := svc.GetJob(context.Background(), "t1", "missing")
	if err != nil {
		t.Fatalf("GetJob unexpected error: %v", err)
	}
	if job != nil {
		t.Errorf("GetJob returned non-nil job for missing id")
	}
}

func TestGetJob_RepoError(t *testing.T) {
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{getErr: repoErr}}
	svc := newTestService(repo)

	_, err := svc.GetJob(context.Background(), "t1", "j1")
	if !errors.Is(err, repoErr) {
		t.Fatalf("GetJob error = %v, want repoErr", err)
	}
}

// ---- ListJobs ----

func TestListJobs_All(t *testing.T) {
	jobs := []models.SandboxJob{
		{ID: "j1", Status: models.JobStatusPending},
		{ID: "j2", Status: models.JobStatusCompleted},
	}
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{listJobs: jobs}}
	svc := newTestService(repo)

	result, err := svc.ListJobs(context.Background(), "t1", "")
	if err != nil {
		t.Fatalf("ListJobs unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("ListJobs len = %d, want 2", len(result))
	}
	if repo.stub.listStatus != "" {
		t.Errorf("listStatus = %q, want empty", repo.stub.listStatus)
	}
}

func TestListJobs_FilteredByStatus(t *testing.T) {
	jobs := []models.SandboxJob{{ID: "j1", Status: models.JobStatusFailed}}
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{listJobs: jobs}}
	svc := newTestService(repo)

	_, err := svc.ListJobs(context.Background(), "t1", models.JobStatusFailed)
	if err != nil {
		t.Fatalf("ListJobs unexpected error: %v", err)
	}
	if repo.stub.listStatus != models.JobStatusFailed {
		t.Errorf("listStatus = %q, want %q", repo.stub.listStatus, models.JobStatusFailed)
	}
}

func TestListJobs_RepoError(t *testing.T) {
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{listErr: repoErr}}
	svc := newTestService(repo)

	_, err := svc.ListJobs(context.Background(), "t1", "")
	if !errors.Is(err, repoErr) {
		t.Fatalf("ListJobs error = %v, want repoErr", err)
	}
}

// ---- DeleteJob ----

func TestDeleteJob_Success(t *testing.T) {
	repo := &fakeSandboxRepo{}
	svc := newTestService(repo)

	err := svc.DeleteJob(context.Background(), "t1", "j1")
	if err != nil {
		t.Fatalf("DeleteJob unexpected error: %v", err)
	}
	if repo.stub.deleteTenant != "t1" {
		t.Errorf("deleteTenant = %s", repo.stub.deleteTenant)
	}
	if repo.stub.deleteID != "j1" {
		t.Errorf("deleteID = %s", repo.stub.deleteID)
	}
}

func TestDeleteJob_RepoError(t *testing.T) {
	repo := &fakeSandboxRepo{stub: struct {
		createErr    error
		getErr       error
		listErr      error
		deleteErr    error
		getJob       *models.SandboxJob
		listJobs     []models.SandboxJob
		createJob    *models.SandboxJob
		getID        string
		getTenant    string
		listStatus   string
		deleteID     string
		deleteTenant string
	}{deleteErr: repoErr}}
	svc := newTestService(repo)

	err := svc.DeleteJob(context.Background(), "t1", "j1")
	if !errors.Is(err, repoErr) {
		t.Fatalf("DeleteJob error = %v, want repoErr", err)
	}
}

// ---- WithConfig ----

func TestService_WithConfig(t *testing.T) {
	repo := &fakeSandboxRepo{}
	svc := newTestService(repo)

	customCfg := models.SandboxConfig{
		MaxCPU: 4.0, MaxMemory: 512 * 1024 * 1024,
	}
	svc.WithConfig(customCfg)

	req := models.CreateSandboxJobRequest{Code: "x", Language: "python"}
	job, err := svc.CreateJob(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("CreateJob error: %v", err)
	}
	if job.MaxCPU != 4.0 {
		t.Errorf("MaxCPU = %f, want 4.0", job.MaxCPU)
	}
	if job.MaxMemory != 512*1024*1024 {
		t.Errorf("MaxMemory = %d", job.MaxMemory)
	}
}
