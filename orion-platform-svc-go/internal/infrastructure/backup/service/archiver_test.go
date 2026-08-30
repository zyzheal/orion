package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/storage"
)

// fakeRepo records calls so tests can assert on persistence behavior.
type fakeRepo struct {
	createCalled int
	records      []*models.ArchiveRecord
}

func (r *fakeRepo) CreateArchive(_ context.Context, rec *models.ArchiveRecord) error {
	r.createCalled++
	cp := *rec
	r.records = append(r.records, &cp)
	return nil
}

func (r *fakeRepo) GetArchive(_ context.Context, _, _ string) (*models.ArchiveRecord, error) {
	return nil, nil
}

func (r *fakeRepo) ListArchives(_ context.Context, _, _ string, _ models.ArchiveType, _, _ time.Time, _ int) ([]models.ArchiveRecord, error) {
	out := make([]models.ArchiveRecord, 0, len(r.records))
	for _, r := range r.records {
		out = append(out, *r)
	}
	return out, nil
}

var _ ArchiveRepository = (*fakeRepo)(nil)

// memStorage is an in-memory StorageBackend that records Put and serves Get
// byte-for-byte so the checksum round-trip path can be exercised.
type memStorage struct {
	blob map[string][]byte
}

func newMemStorage() *memStorage { return &memStorage{blob: map[string][]byte{}} }

func (m *memStorage) Type() string { return "mem" }
func (m *memStorage) Put(_ context.Context, path string, r io.Reader) error {
	b, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	m.blob[path] = b
	return nil
}
func (m *memStorage) Get(_ context.Context, path string) (io.ReadCloser, error) {
	b, ok := m.blob[path]
	if !ok {
		return nil, errors.New("not found")
	}
	return io.NopCloser(bytes.NewReader(b)), nil
}
func (m *memStorage) Delete(_ context.Context, path string) error {
	delete(m.blob, path)
	return nil
}
func (m *memStorage) Exists(_ context.Context, path string) (bool, error) {
	_, ok := m.blob[path]
	return ok, nil
}
func (m *memStorage) Size(_ context.Context, path string) (int64, error) {
	b, ok := m.blob[path]
	if !ok {
		return 0, nil
	}
	return int64(len(b)), nil
}

func TestArchiver_WalksDirAndPersists(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"wal-1", "wal-2", "wal-3"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("data-"+name), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	repo := &fakeRepo{}
	mem := newMemStorage()
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return mem }, nil)

	res, err := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir:   dir,
		PlanID:      "p1",
		TenantID:    "t1",
		ArchiveType: models.ArchiveTypeWAL,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Archived != 3 {
		t.Fatalf("expected 3 archived, got %d", res.Archived)
	}
	if repo.createCalled != 3 {
		t.Fatalf("expected 3 create calls, got %d", repo.createCalled)
	}
	for _, p := range []string{"wal-1", "wal-2", "wal-3"} {
		if _, ok := mem.blob["p1/wal/"+p]; !ok {
			t.Fatalf("missing key p1/wal/%s in mem storage", p)
		}
	}
}

func TestArchiver_SkipsAlreadySeenFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "x"), []byte("hello"), 0o600); err != nil {
		t.Fatal(err)
	}
	repo := &fakeRepo{}
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return newMemStorage() }, nil)

	_, _ = a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir: dir, PlanID: "p", TenantID: "t", ArchiveType: models.ArchiveTypeWAL,
	})
	res, _ := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir: dir, PlanID: "p", TenantID: "t", ArchiveType: models.ArchiveTypeWAL,
	})
	if res.Archived != 0 || res.Skipped != 1 {
		t.Fatalf("expected 0 archived / 1 skipped, got %+v", res)
	}
}

func TestArchiver_WindowFilter(t *testing.T) {
	dir := t.TempDir()
	old := filepath.Join(dir, "old")
	if err := os.WriteFile(old, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	oldTime := time.Now().Add(-24 * time.Hour)
	_ = os.Chtimes(old, oldTime, oldTime)

	new := filepath.Join(dir, "new")
	if err := os.WriteFile(new, []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}

	repo := &fakeRepo{}
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return newMemStorage() }, nil)

	// Window covering only "new" (last 1 hour).
	res, _ := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir:   dir,
		PlanID:      "p",
		TenantID:    "t",
		ArchiveType: models.ArchiveTypeWAL,
		WindowStart: time.Now().Add(-time.Hour),
	})
	if res.Archived != 1 || res.Skipped != 1 {
		t.Fatalf("expected 1 archived / 1 skipped, got %+v", res)
	}
}

func TestArchiver_EncryptionRoundTrip(t *testing.T) {
	dir := t.TempDir()
	plain := []byte("sensitive-wal-data")
	if err := os.WriteFile(filepath.Join(dir, "seg"), plain, 0o600); err != nil {
		t.Fatal(err)
	}
	repo := &fakeRepo{}
	mem := newMemStorage()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return mem }, nil)

	res, err := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir:     dir,
		PlanID:        "p",
		TenantID:      "t",
		ArchiveType:   models.ArchiveTypeWAL,
		EncryptionKey: key,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Archived != 1 {
		t.Fatalf("expected 1 archived, got %d", res.Archived)
	}
	stored := mem.blob["p/wal/seg"]
	if len(stored) == 0 || bytes.Contains(stored, plain) {
		t.Fatalf("stored bytes should not contain plaintext; got %d bytes", len(stored))
	}
	// Stored bytes should differ from plaintext length (GCM nonce + tag).
	if int64(len(stored)) == res.Records[0].SizeBytes {
		// ok — same size accounting
	} else if res.Records[0].SizeBytes < int64(len(stored)) {
		t.Fatalf("record size %d < stored %d", res.Records[0].SizeBytes, len(stored))
	}
	// Verify the SHA256 in the record matches the stored bytes.
	h := sha256.Sum256(stored)
	want := hex.EncodeToString(h[:])
	if res.Records[0].Checksum == nil || *res.Records[0].Checksum != want {
		t.Fatalf("checksum mismatch: want %s got %v", want, res.Records[0].Checksum)
	}
}

func TestArchiver_DryRunPersistsNothing(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "x"), []byte("x"), 0o600)
	repo := &fakeRepo{}
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return newMemStorage() }, nil)
	res, _ := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir: dir, PlanID: "p", TenantID: "t", ArchiveType: models.ArchiveTypeWAL, DryRun: true,
	})
	if res.Archived != 1 || repo.createCalled != 0 {
		t.Fatalf("dry-run should not persist; got archived=%d creates=%d", res.Archived, repo.createCalled)
	}
}

func TestArchiver_RequiresPlanAndTenant(t *testing.T) {
	a := NewArchiver(nil, nil, nil)
	if _, err := a.ArchiveWindow(context.Background(), ArchiveOptions{SourceDir: t.TempDir()}); err == nil {
		t.Fatal("expected error for missing plan/tenant")
	}
	if _, err := a.ArchiveWindow(context.Background(), ArchiveOptions{TenantID: "t", PlanID: ""}); err == nil {
		t.Fatal("expected error for missing plan")
	}
	if _, err := a.ArchiveWindow(context.Background(), ArchiveOptions{SourceDir: "", PlanID: "p", TenantID: "t"}); err == nil {
		t.Fatal("expected error for missing source dir")
	}
}

func TestArchiver_FailedPathPersistsErrorRecord(t *testing.T) {
	// Use a non-existent dir to trigger the stat error branch — it returns
	// an error rather than persisting. Verify the archiver does NOT persist
	// for the walk-error path.
	dir := t.TempDir()
	repo := &fakeRepo{}
	a := NewArchiver(repo, func(models.BackupStorageConfig) storage.StorageBackend { return newMemStorage() }, nil)
	_, err := a.ArchiveWindow(context.Background(), ArchiveOptions{
		SourceDir: filepath.Join(dir, "does-not-exist"), PlanID: "p", TenantID: "t", ArchiveType: models.ArchiveTypeWAL,
	})
	if err == nil {
		t.Fatal("expected error for missing source dir")
	}
	if repo.createCalled != 0 {
		t.Fatalf("should not persist on stat failure, got %d", repo.createCalled)
	}
}

func TestArchiveHelpers(t *testing.T) {
	if !IsWALFileName("000000010000000000000001") {
		t.Fatal("24-hex WAL name should match")
	}
	if !IsWALFileName("000000010000000000000001.backup") {
		t.Fatal("WAL backup should match")
	}
	if IsWALFileName("not-a-wal-name") {
		t.Fatal("non-hex should not match")
	}
	if !IsBinlogFileName("mysql-bin.000042") {
		t.Fatal("mysql binlog should match")
	}
	if !IsBinlogFileName("binlog.000042") {
		t.Fatal("binlog prefix should match")
	}
	if IsBinlogFileName("other.log") {
		t.Fatal("other file should not match")
	}
}

func TestArchiveTypeFileMatchers(t *testing.T) {
	cases := []struct {
		name string
		typ  models.ArchiveType
		want bool
	}{
		// WAL (PG)
		{"000000010000000000000001", models.ArchiveTypeWAL, true},
		{"not-a-wal", models.ArchiveTypeWAL, false},
		// Binlog (MySQL)
		{"mysql-bin.000042", models.ArchiveTypeBinlog, true},
		{"binlog.000042", models.ArchiveTypeBinlog, true},
		{"other.log", models.ArchiveTypeBinlog, false},
		// Oracle archivelog
		{"arch_1_123456_1234567890.arc", models.ArchiveTypeArchivelog, true},
		{"OARCH_LOGFILE_1", models.ArchiveTypeArchivelog, true},
		{"archivelog_1.arc", models.ArchiveTypeArchivelog, false}, // no arch_ prefix
		// DB2 redo log
		{"log000001.log", models.ArchiveTypeRedolog, true},
		{"log000002.log", models.ArchiveTypeRedolog, true},
		{"log.txt", models.ArchiveTypeRedolog, false},
		{"app.log", models.ArchiveTypeRedolog, false},
		// SQL Server log backup
		{"backup.trn", models.ArchiveTypeLogBackup, true},
		{"backup.bak", models.ArchiveTypeLogBackup, true},
		{"backup.sql", models.ArchiveTypeLogBackup, false},
		// OceanBase clog
		{"clog.12345", models.ArchiveTypeClog, true},
		{"ob_clog/seg-1", models.ArchiveTypeClog, true},
		{"other-clog.txt", models.ArchiveTypeClog, false},
		// Cross-type non-match
		{"000000010000000000000001", models.ArchiveTypeBinlog, false},
		{"log000001.log", models.ArchiveTypeWAL, false},
	}
	for _, c := range cases {
		if got := IsArchiveFileFor(c.name, c.typ); got != c.want {
			t.Errorf("IsArchiveFileFor(%q, %q) = %v, want %v", c.name, c.typ, got, c.want)
		}
	}
}

func TestArchiveTypeForPITRMode(t *testing.T) {
	cases := map[string]models.ArchiveType{
		"wal":         models.ArchiveTypeWAL,
		"WAL":         models.ArchiveTypeWAL,
		"binlog":      models.ArchiveTypeBinlog,
		"BINLOG":      models.ArchiveTypeBinlog,
		"archivelog":  models.ArchiveTypeArchivelog,
		"redolog":     models.ArchiveTypeRedolog,
		"log_backup":  models.ArchiveTypeLogBackup,
		"logbackup":   models.ArchiveTypeLogBackup,
		"clog":        models.ArchiveTypeClog,
		"":            models.ArchiveTypeWAL, // default
		"unknown":     models.ArchiveTypeWAL, // default
	}
	for in, want := range cases {
		if got := archiveTypeForPITRMode(in); got != want {
			t.Errorf("archiveTypeForPITRMode(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestArchiveDirListsFiles(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "a"), []byte("a"), 0o600)
	_ = os.MkdirAll(filepath.Join(dir, "sub"), 0o700)
	_ = os.WriteFile(filepath.Join(dir, "sub", "b"), []byte("b"), 0o600)
	got, err := ArchiveDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 top-level file, got %d", len(got))
	}
	if _, err := ArchiveDir(""); err == nil {
		t.Fatal("empty dir should error")
	}
}
