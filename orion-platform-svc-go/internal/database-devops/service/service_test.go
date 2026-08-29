package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/database-devops/models"
)

// ARCH-0.10, remainder: backup / restore coverage.
//
// These tests pin the CONTRACT of ExecuteBackup / ExecuteRestore — the operation
// lookup, the status lifecycle, the result round-trip and the tenant scoping.
// They deliberately do NOT claim that a backup is produced: the service still
// carries "TODO: Execute actual backup based on cfg.BackupType" (service.go) and
// returns a placeholder result. The contract is what a real backup engine must
// keep honouring, so the tests stay valid once the TODO is implemented.

// fakeRepo is an in-memory stand-in for repository.Repository. It records every
// call with its arguments so the tests can assert both the call order and that
// tenantID was threaded through on every single one.
type fakeRepo struct {
	ops map[string]*models.DatabaseDevopsItem // key: tenantID+"/"+id

	gets     []string // tenantID+"/"+id
	statuses []call   // UpdateStatus calls, in order
	results  []call
	deletes  []string
}

type call struct{ tenantID, id, value string }

func newFakeRepo() *fakeRepo {
	return &fakeRepo{ops: map[string]*models.DatabaseDevopsItem{}}
}

func key(tenantID, id string) string { return tenantID + "/" + id }

func (f *fakeRepo) seed(tenantID, id, config, databaseID string) *models.DatabaseDevopsItem {
	item := &models.DatabaseDevopsItem{
		ID: id, TenantID: tenantID, Name: "backup-" + id, Type: "backup",
		Status: "pending", DatabaseID: databaseID, Config: config, Enabled: true,
	}
	f.ops[key(tenantID, id)] = item
	return item
}

func (f *fakeRepo) Get(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error) {
	f.gets = append(f.gets, key(tenantID, id))
	return f.ops[key(tenantID, id)], nil
}

func (f *fakeRepo) List(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error) {
	var out []models.DatabaseDevopsItem
	for k, item := range f.ops {
		if strings.HasPrefix(k, tenantID+"/") {
			out = append(out, *item)
		}
	}
	return out, nil
}

func (f *fakeRepo) Create(ctx context.Context, item *models.DatabaseDevopsItem) error {
	f.ops[key(item.TenantID, item.ID)] = item
	return nil
}

func (f *fakeRepo) Update(ctx context.Context, item *models.DatabaseDevopsItem) error {
	return nil
}

func (f *fakeRepo) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	f.statuses = append(f.statuses, call{tenantID, id, status})
	if item := f.ops[key(tenantID, id)]; item != nil {
		item.Status = status
	}
	return nil
}

func (f *fakeRepo) UpdateResult(ctx context.Context, tenantID, id, result string) error {
	f.results = append(f.results, call{tenantID, id, result})
	if item := f.ops[key(tenantID, id)]; item != nil {
		item.Result = result
	}
	return nil
}

func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error {
	f.deletes = append(f.deletes, key(tenantID, id))
	return nil
}

func (f *fakeRepo) CreateDataSource(ctx context.Context, ds *models.DatabaseSource) error { return nil }
func (f *fakeRepo) ListDataSources(ctx context.Context, tenantID string) ([]models.DatabaseSource, error) {
	return nil, nil
}
func (f *fakeRepo) DeleteDataSource(ctx context.Context, tenantID, id string) error { return nil }

func TestExecuteBackup_StatusLifecycle(t *testing.T) {
	repo := newFakeRepo()
	cfg := `{"backup_type":"wal","compress_level":6,"destination":"s3","retain_days":14}`
	repo.seed("t1", "op1", cfg, "db-42")
	svc := newServiceWithRepo(repo)

	result, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err != nil {
		t.Fatalf("ExecuteBackup returned error: %v", err)
	}

	// pending -> running -> completed, in that order, on the right operation.
	want := []call{
		{"t1", "op1", "running"},
		{"t1", "op1", "completed"},
	}
	if len(repo.statuses) != len(want) {
		t.Fatalf("UpdateStatus calls = %d (%+v), want %d", len(repo.statuses), repo.statuses, len(want))
	}
	for i, w := range want {
		if repo.statuses[i] != w {
			t.Errorf("UpdateStatus[%d] = %+v, want %+v", i, repo.statuses[i], w)
		}
	}

	// The result is written back to the operation, and the operation ends
	// completed — not left sitting in "running" if the caller never re-reads it.
	if got := repo.ops[key("t1", "op1")].Status; got != "completed" {
		t.Errorf("final operation status = %q, want completed", got)
	}
	if len(repo.results) != 1 {
		t.Fatalf("UpdateResult calls = %d, want 1", len(repo.results))
	}
	if repo.results[0].tenantID != "t1" || repo.results[0].id != "op1" {
		t.Errorf("UpdateResult targeted %+v, want t1/op1", repo.results[0])
	}

	// result payload: unique id, completed, the parsed backup_type and the
	// operation's database id, and a sane started <= finished window.
	if result.BackupID == "" {
		t.Error("BackupID is empty — the result is not addressable")
	}
	if result.Status != "completed" {
		t.Errorf("Status = %q, want completed", result.Status)
	}
	if !strings.Contains(result.Message, "wal") || !strings.Contains(result.Message, "db-42") {
		t.Errorf("Message = %q, want it to mention backup_type and database_id", result.Message)
	}
	for _, ts := range []string{result.StartedAt, result.FinishedAt} {
		if _, err := time.Parse(time.RFC3339, ts); err != nil {
			t.Errorf("timestamp %q is not RFC3339: %v", ts, err)
		}
	}
	if result.StartedAt > result.FinishedAt {
		t.Errorf("StartedAt %s is after FinishedAt %s", result.StartedAt, result.FinishedAt)
	}

	// The persisted result must round-trip to the same shape the caller got.
	var persisted models.BackupResult
	if err := json.Unmarshal([]byte(repo.results[0].value), &persisted); err != nil {
		t.Fatalf("persisted result is not valid BackupResult JSON: %v", err)
	}
	if persisted.BackupID != result.BackupID || persisted.Status != result.Status {
		t.Errorf("persisted = %+v, returned = %+v — the caller and the row disagree", persisted, result)
	}
}

func TestExecuteBackup_NotFoundDoesNotTouchStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := newServiceWithRepo(repo)

	_, err := svc.ExecuteBackup(context.Background(), "t1", "missing")
	if err == nil || !strings.Contains(err.Error(), "operation not found") {
		t.Fatalf("err = %v, want an operation-not-found error", err)
	}
	if len(repo.statuses) != 0 || len(repo.results) != 0 {
		t.Errorf("a missing operation still wrote state: statuses=%+v results=%+v", repo.statuses, repo.results)
	}
}

func TestExecuteBackup_InvalidConfigFailsBeforeRunning(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "op2", "{not json", "db-9")
	svc := newServiceWithRepo(repo)

	_, err := svc.ExecuteBackup(context.Background(), "t1", "op2")
	if err == nil || !strings.Contains(err.Error(), "parse backup config") {
		t.Fatalf("err = %v, want a config-parse error", err)
	}
	// A malformed config must not leave the operation marked as running.
	if len(repo.statuses) != 0 {
		t.Errorf("UpdateStatus calls = %+v, want none before the config parsed", repo.statuses)
	}
}

func TestExecuteBackup_EmptyConfigStillCompletes(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "op3", "", "db-1")
	svc := newServiceWithRepo(repo)

	result, err := svc.ExecuteBackup(context.Background(), "t1", "op3")
	if err != nil {
		t.Fatalf("ExecuteBackup with an empty config errored: %v", err)
	}
	if result.Status != "completed" || result.BackupID == "" {
		t.Errorf("result = %+v, want a completed result with an id", result)
	}
}

func TestExecuteRestore_StatusLifecycleAndTenantScoping(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "r1", `{"backup_id":"b-7","point_in_time":"2026-08-26T00:00:00Z","dry_run":true}`, "db-1")
	svc := newServiceWithRepo(repo)

	if err := svc.ExecuteRestore(context.Background(), "t1", "r1"); err != nil {
		t.Fatalf("ExecuteRestore returned error: %v", err)
	}

	want := []call{
		{"t1", "r1", "running"},
		{"t1", "r1", "completed"},
	}
	if len(repo.statuses) != len(want) {
		t.Fatalf("UpdateStatus calls = %d (%+v), want %d", len(repo.statuses), repo.statuses, len(want))
	}
	for i, w := range want {
		if repo.statuses[i] != w {
			t.Errorf("UpdateStatus[%d] = %+v, want %+v", i, repo.statuses[i], w)
		}
	}
	if repo.ops[key("t1", "r1")].Status != "completed" {
		t.Errorf("final status = %q, want completed", repo.ops[key("t1", "r1")].Status)
	}

	// Tenant isolation: every call the service makes carries the caller's tenant.
	// A restore must never be executed against another tenant's operation.
	for _, c := range repo.statuses {
		if c.tenantID != "t1" {
			t.Errorf("UpdateStatus used tenant %q, want t1", c.tenantID)
		}
	}
	for _, g := range repo.gets {
		if !strings.HasPrefix(g, "t1/") {
			t.Errorf("Get targeted %q, want a t1 operation", g)
		}
	}
}

func TestExecuteRestore_NotFound(t *testing.T) {
	repo := newFakeRepo()
	svc := newServiceWithRepo(repo)

	if err := svc.ExecuteRestore(context.Background(), "t1", "missing"); err == nil ||
		!strings.Contains(err.Error(), "operation not found") {
		t.Fatalf("err = %v, want an operation-not-found error", err)
	}
	if len(repo.statuses) != 0 {
		t.Errorf("a missing operation still wrote state: %+v", repo.statuses)
	}
}

func TestExecuteRestore_InvalidConfigFailsBeforeRunning(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "r2", "{not json", "db-2")
	svc := newServiceWithRepo(repo)

	if err := svc.ExecuteRestore(context.Background(), "t1", "r2"); err == nil ||
		!strings.Contains(err.Error(), "parse restore config") {
		t.Fatalf("err = %v, want a config-parse error", err)
	}
	if len(repo.statuses) != 0 {
		t.Errorf("UpdateStatus calls = %+v, want none before the config parsed", repo.statuses)
	}
}

// NewService(nil) is how the platform wires this module when no DB is available
// (repository.Repository no-ops on a nil sqlx.DB). That path must not panic.
func TestNewServiceNilDBIsTolerated(t *testing.T) {
	svc := NewService(nil)
	items, err := svc.ListOperations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListOperations with a nil DB errored: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("ListOperations with a nil DB returned %d items, want 0", len(items))
	}
}
