package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/database-devops/models"
	"orion/platform-svc-go/internal/infrastructure/backup/executor"
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

// ==================== Real execution path tests ====================

// fakeExecutor implements executor.BackupExecutor and executor.RestoreExecutor
// for testing real backup/restore without invoking pg_dump or mysqldump.
type fakeExecutor struct {
	dialect         executor.Dialect
	backupOutput    string
	backupSize      int64
	backupChecksum  string
	backupError     error
	restoreError    error
	restoreBackupPath string
	restoreOpts     *executor.RestoreOptions
}

func (f *fakeExecutor) Dialect() executor.Dialect { return f.dialect }

func (f *fakeExecutor) Backup(_ context.Context, _ executor.ConnInfo, opts executor.BackupOptions) (*executor.BackupResult, error) {
	if f.backupError != nil {
		return nil, f.backupError
	}
	// Write a dummy artifact so the path exists
	if err := os.MkdirAll(filepath.Dir(opts.OutputPath), 0o750); err != nil {
		return nil, err
	}
	if err := os.WriteFile(opts.OutputPath, []byte("dummy-backup-data"), 0o644); err != nil {
		return nil, err
	}
	return &executor.BackupResult{
		OutputPath:     opts.OutputPath,
		SizeBytes:      f.backupSize,
		ChecksumSHA256: f.backupChecksum,
	}, nil
}

func (f *fakeExecutor) Restore(_ context.Context, opts executor.RestoreOptions) (*executor.RestoreResult, error) {
	f.restoreBackupPath = opts.BackupPath
	f.restoreOpts = &opts
	if f.restoreError != nil {
		return nil, f.restoreError
	}
	return &executor.RestoreResult{
		Duration:     100 * time.Millisecond,
		RowsRestored: 1000,
	}, nil
}

// --- Tests ---

func TestExecuteBackup_RealExecutor_Success(t *testing.T) {
	repo := newFakeRepo()
	cfg := `{"backup_type":"full","compress_level":9,"destination":"local"}`
	repo.seed("t1", "op1", cfg, "db-42")

	tmpDir := t.TempDir()
	exe := &fakeExecutor{
		dialect:      executor.DialectPostgreSQL,
		backupSize:   2048,
		backupChecksum: "abc123",
	}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{Host: "localhost", Port: "5432", DB: "orion", User: "admin"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(tmpDir)

	result, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err != nil {
		t.Fatalf("ExecuteBackup returned error: %v", err)
	}

	// Real execution should populate OutputPath and ChecksumSHA256
	if result.OutputPath == "" {
		t.Error("OutputPath is empty — expected a real artifact path")
	}
	if result.ChecksumSHA256 != "abc123" {
		t.Errorf("ChecksumSHA256 = %q, want 'abc123'", result.ChecksumSHA256)
	}
	if result.Size != 2048 {
		t.Errorf("Size = %d, want 2048", result.Size)
	}
	if result.Status != "completed" {
		t.Errorf("Status = %q, want completed", result.Status)
	}
	// Message should NOT contain the placeholder marker
	if strings.Contains(result.Message, "placeholder") {
		t.Errorf("Message = %q — should not be a placeholder when executor is configured", result.Message)
	}
	// Final operation status should be completed
	if got := repo.ops[key("t1", "op1")].Status; got != "completed" {
		t.Errorf("final operation status = %q, want completed", got)
	}
	// An artifact should exist on disk
	if _, err := os.Stat(result.OutputPath); err != nil {
		t.Errorf("artifact at %s does not exist: %v", result.OutputPath, err)
	}
}

func TestExecuteBackup_RealExecutor_ConnResolverError(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "op1", `{"backup_type":"full"}`, "db-42")

	exe := &fakeExecutor{dialect: executor.DialectPostgreSQL}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return nil, "", fmt.Errorf("database not found")
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	_, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err == nil {
		t.Fatal("expected error from conn resolver failure")
	}
	if !strings.Contains(err.Error(), "resolve conn info") {
		t.Errorf("err = %v, want it to mention 'resolve conn info'", err)
	}
	// Status should be failed
	if got := repo.ops[key("t1", "op1")].Status; got != "failed" {
		t.Errorf("status = %q, want 'failed'", got)
	}
}

func TestExecuteBackup_RealExecutor_NoExecutorForDialect(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "op1", `{"backup_type":"full"}`, "db-42")

	// Registry with no executors registered
	reg := executor.NewEmptyRegistry()

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{DB: "orion"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	_, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err == nil {
		t.Fatal("expected error — no executor registered for postgresql")
	}
	if !strings.Contains(err.Error(), "no backup executor") {
		t.Errorf("err = %v, want 'no backup executor'", err)
	}
}

func TestExecuteBackup_RealExecutor_BackupFails(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "op1", `{"backup_type":"full"}`, "db-42")

	exe := &fakeExecutor{
		dialect:     executor.DialectPostgreSQL,
		backupError: fmt.Errorf("pg_dump failed"),
	}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{DB: "orion"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	_, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err == nil {
		t.Fatal("expected error from backup failure")
	}
	if !strings.Contains(err.Error(), "backup executor failed") {
		t.Errorf("err = %v, want 'backup executor failed'", err)
	}
	if got := repo.ops[key("t1", "op1")].Status; got != "failed" {
		t.Errorf("status = %q, want 'failed'", got)
	}
}

func TestExecuteBackup_CanExecuteFalse_NoExecutorSet(t *testing.T) {
	// Verify graceful degradation: with only registry set but no resolver,
	// placeholder behavior is used.
	repo := newFakeRepo()
	repo.seed("t1", "op1", `{"backup_type":"full"}`, "db-42")

	reg := executor.NewEmptyRegistry()
	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	// No conn resolver set

	if svc.canExecute() {
		t.Fatal("canExecute should be false without conn resolver")
	}

	result, err := svc.ExecuteBackup(context.Background(), "t1", "op1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.OutputPath != "" {
		t.Errorf("OutputPath should be empty in placeholder mode, got %q", result.OutputPath)
	}
	if !strings.Contains(result.Message, "placeholder") {
		t.Errorf("Message should contain 'placeholder', got %q", result.Message)
	}
}

func TestExecuteRestore_RealExecutor_Success(t *testing.T) {
	repo := newFakeRepo()
	cfg := `{"backup_id":"b-7","backup_path":"/var/backups/orion/b-7.dump","point_in_time":"2026-08-26T00:00:00Z"}`
	repo.seed("t1", "r1", cfg, "db-42")

	exe := &fakeExecutor{dialect: executor.DialectPostgreSQL}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{Host: "localhost", Port: "5432", DB: "orion"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	if err := svc.ExecuteRestore(context.Background(), "t1", "r1"); err != nil {
		t.Fatalf("ExecuteRestore returned error: %v", err)
	}

	// Verify the executor was called with the right backup path
	if exe.restoreBackupPath != "/var/backups/orion/b-7.dump" {
		t.Errorf("restoreBackupPath = %q, want '/var/backups/orion/b-7.dump'", exe.restoreBackupPath)
	}
	// Verify PITR timestamp was parsed
	if exe.restoreOpts == nil {
		t.Fatal("restoreOpts is nil — executor was not called")
	}
	if exe.restoreOpts.TargetTime == nil {
		t.Error("TargetTime is nil — PITR timestamp was not parsed")
	} else {
		want := time.Date(2026, 8, 26, 0, 0, 0, 0, time.UTC)
		if !exe.restoreOpts.TargetTime.Equal(want) {
			t.Errorf("TargetTime = %v, want %v", exe.restoreOpts.TargetTime, want)
		}
	}
	// Final status should be completed
	if got := repo.ops[key("t1", "r1")].Status; got != "completed" {
		t.Errorf("final status = %q, want completed", got)
	}
}

func TestExecuteRestore_RealExecutor_MissingBackupPath(t *testing.T) {
	repo := newFakeRepo()
	// Config without backup_path
	repo.seed("t1", "r1", `{"backup_id":"b-7"}`, "db-42")

	exe := &fakeExecutor{dialect: executor.DialectPostgreSQL}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{DB: "orion"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	err := svc.ExecuteRestore(context.Background(), "t1", "r1")
	if err == nil {
		t.Fatal("expected error when backup_path is missing")
	}
	if !strings.Contains(err.Error(), "backup_path") {
		t.Errorf("err = %v, want it to mention 'backup_path'", err)
	}
	if got := repo.ops[key("t1", "r1")].Status; got != "failed" {
		t.Errorf("status = %q, want 'failed'", got)
	}
}

func TestExecuteRestore_RealExecutor_InvalidPointInTime(t *testing.T) {
	repo := newFakeRepo()
	repo.seed("t1", "r1", `{"backup_path":"/backup.dump","point_in_time":"not-a-date"}`, "db-42")

	exe := &fakeExecutor{dialect: executor.DialectPostgreSQL}
	reg := executor.NewEmptyRegistry()
	reg.Register(exe)

	resolver := func(_ context.Context, _, _ string) (*executor.ConnInfo, executor.Dialect, error) {
		return &executor.ConnInfo{DB: "orion"}, executor.DialectPostgreSQL, nil
	}

	svc := newServiceWithRepo(repo)
	svc.SetExecutorRegistry(reg)
	svc.SetConnResolver(resolver)
	svc.SetBackupDir(t.TempDir())

	err := svc.ExecuteRestore(context.Background(), "t1", "r1")
	if err == nil {
		t.Fatal("expected error for invalid point_in_time")
	}
	if !strings.Contains(err.Error(), "point_in_time") {
		t.Errorf("err = %v, want it to mention 'point_in_time'", err)
	}
}

func TestCanExecute(t *testing.T) {
	tests := []struct {
		name   string
		hasReg bool
		hasRes bool
		want   bool
	}{
		{"neither", false, false, false},
		{"registry only", true, false, false},
		{"resolver only", false, true, false},
		{"both", true, true, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := newServiceWithRepo(newFakeRepo())
			if tt.hasReg {
				svc.SetExecutorRegistry(executor.NewEmptyRegistry())
			}
			if tt.hasRes {
				svc.SetConnResolver(func(ctx context.Context, tenantID, databaseID string) (*executor.ConnInfo, executor.Dialect, error) {
					return nil, "", nil
				})
			}
			if got := svc.canExecute(); got != tt.want {
				t.Errorf("canExecute() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSetBackupDir_EmptyDoesNotOverride(t *testing.T) {
	svc := newServiceWithRepo(newFakeRepo())
	svc.SetBackupDir("/custom/path")
	if svc.backupDir != "/custom/path" {
		t.Errorf("backupDir = %q, want '/custom/path'", svc.backupDir)
	}
	svc.SetBackupDir("")
	if svc.backupDir != "/custom/path" {
		t.Errorf("backupDir = %q after empty set, want '/custom/path' (unchanged)", svc.backupDir)
	}
}
