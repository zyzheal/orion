package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/cmdb-import/models"
	"orion/platform-svc-go/internal/cmdb-import/repository"
)

// fakeRepo is a recording in-memory RepositoryInterface. Every mutating call
// records its arguments so tests can assert exactly what the service sent —
// the caller's tenant, the final status, the row counts — without a database.
type fakeRepo struct {
	jobs    map[string]*models.CMDBImportJob
	records []models.CMDBImportRecord

	lastStatus       string
	lastStatusErrMsg *string
	lastTotalCount   int
	lastSuccessCount int
	lastErrorCount   int

	getJobErr       error
	updateCountsErr error
	updateStatusErr error
}

func newFakeRepo(jobs ...*models.CMDBImportJob) *fakeRepo {
	r := &fakeRepo{jobs: map[string]*models.CMDBImportJob{}}
	for _, j := range jobs {
		r.jobs[j.ID] = j
	}
	return r
}

func (f *fakeRepo) CreateJob(ctx context.Context, j *models.CMDBImportJob) error {
	f.jobs[j.ID] = j
	return nil
}

func (f *fakeRepo) GetJob(ctx context.Context, id string) (*models.CMDBImportJob, error) {
	if f.getJobErr != nil {
		return nil, f.getJobErr
	}
	j, ok := f.jobs[id]
	if !ok {
		return nil, repository.ErrNotFound
	}
	return j, nil
}

func (f *fakeRepo) UpdateJobStatus(ctx context.Context, id, status string, errMsg *string, startedAt, finishedAt *time.Time) (*models.CMDBImportJob, error) {
	f.lastStatus = status
	f.lastStatusErrMsg = errMsg
	return f.jobs[id], f.updateStatusErr
}

func (f *fakeRepo) UpdateJobCounts(ctx context.Context, id string, totalCount, successCount, errorCount int) error {
	f.lastTotalCount = totalCount
	f.lastSuccessCount = successCount
	f.lastErrorCount = errorCount
	return f.updateCountsErr
}

func (f *fakeRepo) CreateRecord(ctx context.Context, rec *models.CMDBImportRecord) error {
	f.records = append(f.records, *rec)
	return nil
}

func (f *fakeRepo) ListRecordsByJob(ctx context.Context, jobID string, offset, limit int) ([]models.CMDBImportRecord, error) {
	return f.records, nil
}

func (f *fakeRepo) ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.CMDBImportJob, error) {
	return nil, nil
}

var _ RepositoryInterface = (*fakeRepo)(nil)

// writeJSONSource writes a JSON source file into a temp dir and returns its path.
func writeJSONSource(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "source.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write source: %v", err)
	}
	return path
}

// newPendingJSONJob builds a pending JSON import job for the given source file.
func newPendingJSONJob(id, tenantID, sourcePath string) *models.CMDBImportJob {
	return &models.CMDBImportJob{
		ID:         id,
		TenantID:   tenantID,
		SourceType: "json",
		SourcePath: sourcePath,
		Mode:       "upsert",
		Status:     string(models.JobStatusPending),
	}
}

// ---------------------------------------------------------------------------
// Fix #1: SFTPHandler.Validate delegates to the shared validateMapping so its
// contract matches every other handler (uniform column hints + missing-column
// errors) instead of a hard-coded "sftp not implemented" string.
// ---------------------------------------------------------------------------

func TestService_IMPORT_SFTPValidateUniformContract(t *testing.T) {
	h := &SFTPHandler{}
	rows := []map[string]interface{}{{"name": "a", "ip": "1.2.3.4"}}

	hints, errs := h.Validate(rows, map[string]string{"name": "ci_name"})
	if len(errs) != 0 {
		t.Fatalf("valid mapping produced errors: %v", errs)
	}
	if len(hints) != 2 {
		t.Fatalf("expected 2 column hints, got %v", hints)
	}

	_, errs = h.Validate(rows, map[string]string{"missing": "x"})
	if len(errs) != 1 || !strings.Contains(errs[0], "mapped source column not found") {
		t.Fatalf("missing column not reported: %v", errs)
	}

	_, errs = h.Validate(nil, nil)
	if len(errs) != 1 || errs[0] != "no rows parsed from source" {
		t.Fatalf("empty rows not reported: %v", errs)
	}
}

// ---------------------------------------------------------------------------
// Fix #2: StartJob and GetJob enforce cross-tenant isolation — a caller may
// only start/read its own job; a tenant mismatch surfaces ErrJobNotFound
// rather than leaking another tenant's job.
// ---------------------------------------------------------------------------

func TestService_IMPORT_StartJob_CrossTenantIsolation(t *testing.T) {
	repo := newFakeRepo(&models.CMDBImportJob{
		ID: "job-1", TenantID: "tenant-A",
		Status:     string(models.JobStatusPending),
		SourceType: "json",
		SourcePath: "/tmp/never-read.json",
	})
	m := NewCMDBImportManager(repo)

	// A different tenant must be told the job does not exist.
	err := m.StartJob(context.Background(), "tenant-B", "job-1")
	if !errors.Is(err, ErrJobNotFound) {
		t.Fatalf("StartJob other tenant: expected ErrJobNotFound, got %v", err)
	}

	// The owning tenant passes the guard (parse fails on the bogus path, but
	// that is a different error — not ErrJobNotFound).
	err = m.StartJob(context.Background(), "tenant-A", "job-1")
	if errors.Is(err, ErrJobNotFound) {
		t.Fatalf("StartJob own tenant: job must not be hidden as not found")
	}
}

func TestService_IMPORT_GetJob_CrossTenantIsolation(t *testing.T) {
	repo := newFakeRepo(&models.CMDBImportJob{ID: "job-1", TenantID: "tenant-A"})
	m := NewCMDBImportManager(repo)

	if _, err := m.GetJob(context.Background(), "tenant-B", "job-1"); !errors.Is(err, ErrJobNotFound) {
		t.Fatalf("GetJob other tenant: expected ErrJobNotFound, got %v", err)
	}
	if _, err := m.GetJob(context.Background(), "tenant-A", "job-1"); err != nil {
		t.Fatalf("GetJob own tenant: unexpected error %v", err)
	}
	// System context (no tenant) can still operate.
	if _, err := m.GetJob(context.Background(), "", "job-1"); err != nil {
		t.Fatalf("GetJob system tenant: unexpected error %v", err)
	}
}

// ---------------------------------------------------------------------------
// Fix #3: UpdateJobCounts errors are propagated to the caller instead of being
// swallowed, so a job whose rows were processed but whose counts failed to
// persist is not silently reported as done.
// ---------------------------------------------------------------------------

func TestService_IMPORT_StartJob_UpdateCountsErrorPropagates(t *testing.T) {
	src := writeJSONSource(t, `[{"name":"a"}]`)
	repo := newFakeRepo(newPendingJSONJob("job-0001", "tenant-1", src))
	repo.updateCountsErr = errors.New("disk full")
	m := NewCMDBImportManager(repo)

	err := m.StartJob(context.Background(), "tenant-1", "job-0001")
	if err == nil || !strings.Contains(err.Error(), "update counts failed") {
		t.Fatalf("UpdateJobCounts error not propagated, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Fix #4: a job where every row failed is marked failed (errorCount >=
// totalCount). The previous `>` inverted the edge case: an all-failed job was
// marked completed while a partially-failed one was correctly marked failed.
// ---------------------------------------------------------------------------

func TestService_IMPORT_StartJob_AllRowsFailedMarksFailed(t *testing.T) {
	src := writeJSONSource(t, `[{"__error__":"boom"}]`)
	repo := newFakeRepo(newPendingJSONJob("job-0001", "tenant-1", src))
	m := NewCMDBImportManager(repo)

	if err := m.StartJob(context.Background(), "tenant-1", "job-0001"); err != nil {
		t.Fatalf("StartJob: %v", err)
	}
	if repo.lastStatus != string(models.JobStatusFailed) {
		t.Fatalf("all rows failed: expected status failed, got %q", repo.lastStatus)
	}
	if repo.lastTotalCount != 1 || repo.lastErrorCount != 1 {
		t.Fatalf("counts: total=%d success=%d error=%d", repo.lastTotalCount, repo.lastSuccessCount, repo.lastErrorCount)
	}
}

func TestService_IMPORT_StartJob_PartialFailureCompletes(t *testing.T) {
	src := writeJSONSource(t, `[{"name":"a"},{"__error__":"boom"}]`)
	repo := newFakeRepo(newPendingJSONJob("job-0001", "tenant-1", src))
	m := NewCMDBImportManager(repo)

	if err := m.StartJob(context.Background(), "tenant-1", "job-0001"); err != nil {
		t.Fatalf("StartJob: %v", err)
	}
	if repo.lastStatus != string(models.JobStatusCompleted) {
		t.Fatalf("partial failure: expected status completed, got %q", repo.lastStatus)
	}
	if repo.lastTotalCount != 2 || repo.lastSuccessCount != 1 || repo.lastErrorCount != 1 {
		t.Fatalf("counts: total=%d success=%d error=%d", repo.lastTotalCount, repo.lastSuccessCount, repo.lastErrorCount)
	}
	if len(repo.records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(repo.records))
	}
}

// ---------------------------------------------------------------------------
// Fix #5: CancelJob guard must not invert isValidStatusTxn (which returns true
// for an INVALID transition). The old `!` rejected every legitimate cancel and
// passed the invalid ones; the guard now rejects exactly the terminal states.
// ---------------------------------------------------------------------------

func TestService_IMPORT_CancelJob_PendingAllowed(t *testing.T) {
	repo := newFakeRepo(&models.CMDBImportJob{ID: "job-1", TenantID: "tenant-1", Status: string(models.JobStatusPending)})
	m := NewCMDBImportManager(repo)

	if err := m.CancelJob(context.Background(), "tenant-1", "job-1"); err != nil {
		t.Fatalf("cancel pending: unexpected error %v", err)
	}
	if repo.lastStatus != string(models.JobStatusCancelled) {
		t.Fatalf("cancel pending: expected cancelled status, got %q", repo.lastStatus)
	}
}

func TestService_IMPORT_CancelJob_RunningAllowed(t *testing.T) {
	repo := newFakeRepo(&models.CMDBImportJob{ID: "job-1", TenantID: "tenant-1", Status: string(models.JobStatusRunning)})
	m := NewCMDBImportManager(repo)

	if err := m.CancelJob(context.Background(), "tenant-1", "job-1"); err != nil {
		t.Fatalf("cancel running: unexpected error %v", err)
	}
	if repo.lastStatus != string(models.JobStatusCancelled) {
		t.Fatalf("cancel running: expected cancelled status, got %q", repo.lastStatus)
	}
}

func TestService_IMPORT_CancelJob_TerminalRejected(t *testing.T) {
	for _, status := range []string{
		string(models.JobStatusCompleted),
		string(models.JobStatusFailed),
		string(models.JobStatusCancelled),
	} {
		repo := newFakeRepo(&models.CMDBImportJob{ID: "job-1", TenantID: "tenant-1", Status: status})
		m := NewCMDBImportManager(repo)

		if err := m.CancelJob(context.Background(), "tenant-1", "job-1"); !errors.Is(err, ErrInvalidStatusTxn) {
			t.Fatalf("cancel %s: expected ErrInvalidStatusTxn, got %v", status, err)
		}
	}
}

func TestService_IMPORT_CancelJob_CrossTenantIsolation(t *testing.T) {
	repo := newFakeRepo(&models.CMDBImportJob{ID: "job-1", TenantID: "tenant-A", Status: string(models.JobStatusPending)})
	m := NewCMDBImportManager(repo)

	if err := m.CancelJob(context.Background(), "tenant-B", "job-1"); !errors.Is(err, ErrJobNotFound) {
		t.Fatalf("cancel other tenant: expected ErrJobNotFound, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// isValStatusTxn semantics are the load-bearing contract behind fix #5; pin
// them directly so a future sign flip is caught at the transition table.
// ---------------------------------------------------------------------------

func TestService_IMPORT_isValidStatusTxn(t *testing.T) {
	m := &CMDBImportManager{}
	cases := []struct {
		from, to string
		invalid  bool
	}{
		{string(models.JobStatusPending), string(models.JobStatusRunning), false},
		{string(models.JobStatusPending), string(models.JobStatusCancelled), false},
		{string(models.JobStatusRunning), string(models.JobStatusCompleted), false},
		{string(models.JobStatusRunning), string(models.JobStatusFailed), false},
		{string(models.JobStatusRunning), string(models.JobStatusCancelled), false},
		{string(models.JobStatusCompleted), string(models.JobStatusRunning), true},
		{string(models.JobStatusFailed), string(models.JobStatusRunning), true},
		{string(models.JobStatusCancelled), string(models.JobStatusRunning), true},
	}
	for _, c := range cases {
		if got := m.isValidStatusTxn(c.from, c.to); got != c.invalid {
			t.Fatalf("isValidStatusTxn(%s, %s) = %v, want %v", c.from, c.to, got, c.invalid)
		}
	}
}
