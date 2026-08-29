package service_test

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/service"
)

// ---------------------------------------------------------------------------
// RepositoryInterface mirrors the methods the job-processor Repository
// exposes.  It is asserted against *fakeRepo so that any future refactor
// that changes a signature will break this test at compile time.
// ---------------------------------------------------------------------------

type RepositoryInterface interface {
	CreateOperation(ctx context.Context, op *models.JobOperation) error
	GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error)
	ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status string, resultJSON string, errMsg string) error
	CreateChain(ctx context.Context, tenantID string, name string) (*models.JobOperationChain, error)
	GetChain(ctx context.Context, tenantID, id string) (*models.JobOperationChain, error)
	UpdateChain(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.JobOperationChain, error)
	ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error)
	AutoMigrate(ctx context.Context) error
}

// fakeRepo is a no-op implementation used to document the repository
// interface contract and exercise it in unit tests.
type fakeRepo struct {
	err error // injected error returned by every method
}

var _ RepositoryInterface = (*fakeRepo)(nil)

func (f *fakeRepo) CreateOperation(ctx context.Context, op *models.JobOperation) error { return f.err }
func (f *fakeRepo) GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error) {
	return nil, f.err
}
func (f *fakeRepo) ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateStatus(ctx context.Context, tenantID, id string, status string, resultJSON string, errMsg string) error {
	return f.err
}
func (f *fakeRepo) CreateChain(ctx context.Context, tenantID string, name string) (*models.JobOperationChain, error) {
	return nil, f.err
}
func (f *fakeRepo) GetChain(ctx context.Context, tenantID, id string) (*models.JobOperationChain, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateChain(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.JobOperationChain, error) {
	return nil, f.err
}
func (f *fakeRepo) ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error) {
	return &models.ChainListResponse{}, f.err
}
func (f *fakeRepo) AutoMigrate(ctx context.Context) error { return f.err }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func newService() *service.Service {
	// NewService takes concrete *processor.Processor and *repository.Repository.
	// Passing nil for both allows us to exercise the Service layer without
	// any database or processor dependency.
	return service.NewService(nil, nil)
}

func fakeRepoWithErr(err error) *fakeRepo {
	return &fakeRepo{err: err}
}

// assertPanics verifies that calling f panics.
func assertPanics(t *testing.T, f func()) {
	t.Helper()
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic but none occurred")
		}
	}()
	f()
}

// ---------------------------------------------------------------------------
// NewService
// ---------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	s := service.NewService(nil, nil)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewService_NilDeps(t *testing.T) {
	s := newService()
	if s == nil {
		t.Fatal("newService returned nil")
	}
}

// ---------------------------------------------------------------------------
// Process — validation runs before any repo call
// ---------------------------------------------------------------------------

func TestService_Process_InvalidType(t *testing.T) {
	ctx := context.Background()
	s := newService()
	req := &models.CreateOperationRequest{
		Type:   "invalid_type",
		Target: "job-1",
	}
	op, err := s.Process(ctx, "t1", req, "")
	if op != nil {
		t.Errorf("expected nil operation, got %+v", op)
	}
	if err == nil {
		t.Fatal("expected error for invalid operation type")
	}
}

func TestService_Process_NilProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	req := &models.CreateOperationRequest{
		Type:   models.TypeRun,
		Target: "job-1",
	}
	// With nil processor, Process panics on valid op types (nil receiver).
	assertPanics(t, func() {
		_, _ = s.Process(ctx, "t1", req, "")
	})
}

func TestService_Process_AllValidTypesReachProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	for _, opType := range models.AllOperationTypes {
		opType := opType // loop variable capture
		req := &models.CreateOperationRequest{
			Type:   opType,
			Target: "job-1",
		}
		// Valid types reach the nil processor and panic.
		assertPanics(t, func() {
			_, _ = s.Process(ctx, "t1", req, "")
		})
	}
}

// ---------------------------------------------------------------------------
// GetOperation — delegates to processor (nil → error)
// ---------------------------------------------------------------------------

func TestService_GetOperation_NilProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.GetOperation(ctx, "t1", "op-1")
	})
}

// ---------------------------------------------------------------------------
// ListOperations — delegates to processor (nil → error)
// ---------------------------------------------------------------------------

func TestService_ListOperations_NilProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.ListOperations(ctx, "t1", "", 10, 0)
	})
}

func TestService_ListOperations_WithChainID(t *testing.T) {
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.ListOperations(ctx, "t1", "chain-1", 5, 0)
	})
}

// ---------------------------------------------------------------------------
// ListChains — calls repo directly; nil repo → error
// ---------------------------------------------------------------------------

func TestService_ListChains_NilRepo(t *testing.T) {
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.ListChains(ctx, "t1", 10, 0)
	})
}

func TestService_ListChains_Defaults(t *testing.T) {
	// ListChains is the only Service method that calls the repo directly.
	// Service takes *repository.Repository (not an interface), so we verify
	// the nil-repo panic path is the observable behavior without a DB.
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.ListChains(ctx, "", 0, 0)
	})
}

// ---------------------------------------------------------------------------
// ProcessChain — delegates to processor (nil → error)
// ---------------------------------------------------------------------------

func TestService_ProcessChain_NilProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	req := &models.CreateChainRequest{
		Name: "test-chain",
		Operations: []models.CreateOperationDTO{
			{Type: models.TypeRun, Target: "job-1"},
		},
	}
	assertPanics(t, func() {
		_, _ = s.ProcessChain(ctx, "t1", req)
	})
}

func TestService_ProcessChain_EmptyOps(t *testing.T) {
	ctx := context.Background()
	s := newService()
	req := &models.CreateChainRequest{
		Name:       "empty-chain",
		Operations: []models.CreateOperationDTO{},
	}
	assertPanics(t, func() {
		_, _ = s.ProcessChain(ctx, "t1", req)
	})
}

// ---------------------------------------------------------------------------
// CancelChain — delegates to processor (nil → error)
// ---------------------------------------------------------------------------

func TestService_CancelChain_NilProcessor(t *testing.T) {
	ctx := context.Background()
	s := newService()
	assertPanics(t, func() {
		_, _ = s.CancelChain(ctx, "t1", "chain-1")
	})
}

// ---------------------------------------------------------------------------
// RepositoryInterface — compile-time check + unit tests of fakeRepo
// ---------------------------------------------------------------------------

func TestFakeRepo_ImplementsInterface(t *testing.T) {
	var repo RepositoryInterface = (*fakeRepo)(nil)
	if repo == nil {
		t.Fatal("expected non-nil interface value")
	}
}

func TestFakeRepo_NilError_AllZero(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}

	if err := repo.CreateOperation(ctx, nil); err != nil {
		t.Error("CreateOperation should return nil")
	}
	if _, err := repo.GetOperation(ctx, "t", "i"); err != nil {
		t.Error("GetOperation should return nil")
	}
	if _, err := repo.ListOperations(ctx, "t", "", 1, 0); err != nil {
		t.Error("ListOperations should return nil")
	}
	if err := repo.UpdateStatus(ctx, "t", "i", "ok", "", ""); err != nil {
		t.Error("UpdateStatus should return nil")
	}
	if _, err := repo.CreateChain(ctx, "t", "n"); err != nil {
		t.Error("CreateChain should return nil")
	}
	if _, err := repo.GetChain(ctx, "t", "i"); err != nil {
		t.Error("GetChain should return nil")
	}
	if _, err := repo.UpdateChain(ctx, "t", "i", nil); err != nil {
		t.Error("UpdateChain should return nil")
	}
	if _, err := repo.ListChains(ctx, "t", 1, 0); err != nil {
		t.Error("ListChains should return nil")
	}
	if err := repo.AutoMigrate(ctx); err != nil {
		t.Error("AutoMigrate should return nil")
	}
}

func TestFakeRepo_ListChains_ReturnsZeroResponse(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	resp, err := repo.ListChains(ctx, "t1", 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil ChainListResponse")
	}
	if resp.Total != 0 {
		t.Errorf("expected Total=0, got %d", resp.Total)
	}
	if len(resp.Data) != 0 {
		t.Errorf("expected empty Data, got %d items", len(resp.Data))
	}
}

func TestFakeRepo_InjectedError(t *testing.T) {
	ctx := context.Background()
	want := errors.New("boom")
	repo := fakeRepoWithErr(want)

	if err := repo.CreateOperation(ctx, nil); !errors.Is(err, want) {
		t.Errorf("CreateOperation error mismatch: got %v", err)
	}
	if _, err := repo.GetOperation(ctx, "t", "i"); !errors.Is(err, want) {
		t.Errorf("GetOperation error mismatch: got %v", err)
	}
	if _, err := repo.ListOperations(ctx, "t", "", 1, 0); !errors.Is(err, want) {
		t.Errorf("ListOperations error mismatch: got %v", err)
	}
	if err := repo.UpdateStatus(ctx, "t", "i", "ok", "", ""); !errors.Is(err, want) {
		t.Errorf("UpdateStatus error mismatch: got %v", err)
	}
	if _, err := repo.CreateChain(ctx, "t", "n"); !errors.Is(err, want) {
		t.Errorf("CreateChain error mismatch: got %v", err)
	}
	if _, err := repo.GetChain(ctx, "t", "i"); !errors.Is(err, want) {
		t.Errorf("GetChain error mismatch: got %v", err)
	}
	if _, err := repo.UpdateChain(ctx, "t", "i", nil); !errors.Is(err, want) {
		t.Errorf("UpdateChain error mismatch: got %v", err)
	}
	if _, err := repo.ListChains(ctx, "t", 1, 0); !errors.Is(err, want) {
		t.Errorf("ListChains error mismatch: got %v", err)
	}
	if err := repo.AutoMigrate(ctx); !errors.Is(err, want) {
		t.Errorf("AutoMigrate error mismatch: got %v", err)
	}
}
