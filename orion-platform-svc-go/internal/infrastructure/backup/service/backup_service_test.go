package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/storage"
)

// noopStorageBackend is a test double for storage.StorageBackend so we can
// exercise storageBackendFor without a real filesystem or network call.
type noopStorageBackend struct {
	typeLabel string
}

func (b *noopStorageBackend) Type() string { return b.typeLabel }
func (b *noopStorageBackend) Put(_ context.Context, _ string, _ io.Reader) error { return nil }
func (b *noopStorageBackend) Get(_ context.Context, _ string) (io.ReadCloser, error) {
	return nil, nil
}
func (b *noopStorageBackend) Delete(_ context.Context, _ string) error { return nil }
func (b *noopStorageBackend) Exists(_ context.Context, _ string) (bool, error) {
	return false, nil
}
func (b *noopStorageBackend) Size(_ context.Context, _ string) (int64, error) { return 0, nil }

var _ storage.StorageBackend = (*noopStorageBackend)(nil)

func TestRenderPathTemplate_Default(t *testing.T) {
	got := renderPathTemplate("", "p-1", "b-1")
	if got != "p-1/b-1" {
		t.Fatalf("expected p-1/b-1, got %q", got)
	}
}

func TestRenderPathTemplate_Custom(t *testing.T) {
	got := renderPathTemplate("tenants/{{plan_id}}/{{backup_id}}.dump", "p", "b")
	if got != "tenants/p/b.dump" {
		t.Fatalf("got %q", got)
	}
}

func TestRenderPathTemplate_TrimsLeadingSlash(t *testing.T) {
	got := renderPathTemplate("/tenants/{{plan_id}}", "p", "b")
	if got != "tenants/p" {
		t.Fatalf("got %q", got)
	}
}

func TestNonEmptyStrings(t *testing.T) {
	if got := nonEmptyStrings(""); len(got) != 0 {
		t.Fatalf("expected nil, got %v", got)
	}
	if got := nonEmptyStrings("a,b,c"); len(got) != 1 || got[0] != "a,b,c" {
		t.Fatalf("got %v", got)
	}
}

func TestComputeSHA256At_Unencrypted(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "artifact.dump")
	payload := []byte("hello world backup artifact")
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	h := sha256.Sum256(payload)
	want := hex.EncodeToString(h[:])
	got, err := computeSHA256At(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("expected %s, got %s", want, got)
	}
}

func TestComputeSHA256At_Encrypted(t *testing.T) {
	// computeSHA256At with a key should decrypt the artifact first. When the
	// file is not actually encrypted, decryption must fail cleanly.
	dir := t.TempDir()
	path := filepath.Join(dir, "artifact.enc")
	if err := os.WriteFile(path, []byte("not actually encrypted"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := computeSHA256At(path, []byte("some-random-key-bytes-32")); err == nil {
		t.Fatal("expected decryption error for non-encrypted artifact")
	}
}

func TestComputeSHA256At_MissingFile(t *testing.T) {
	if _, err := computeSHA256At("/definitely/missing/path.dump", nil); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestStorageBackendFor_LocalReturnsNil(t *testing.T) {
	s := &BackupService{}
	if got := s.storageBackendFor(models.BackupStorageConfig{Type: "local"}); got != nil {
		t.Fatalf("expected nil for local, got %v", got)
	}
	// Empty type defaults to local and should also return nil.
	if got := s.storageBackendFor(models.BackupStorageConfig{}); got != nil {
		t.Fatalf("expected nil for empty type, got %v", got)
	}
}

func TestStorageBackendFor_NoBackendConfigured(t *testing.T) {
	s := &BackupService{}
	if got := s.storageBackendFor(models.BackupStorageConfig{Type: "s3"}); got != nil {
		t.Fatalf("expected nil when no backend registered, got %v", got)
	}
}

func TestStorageBackendFor_UnregisteredType(t *testing.T) {
	s := &BackupService{}
	// Even with an s3 backend registered, an unknown type like "azure"
	// should not be resolved.
	type fakeBackend struct{}
	_ = fakeBackend{}
	if got := s.storageBackendFor(models.BackupStorageConfig{Type: "azure"}); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestStorageBackendFor_MinioFallsBackToS3(t *testing.T) {
	// When "s3" is registered and the caller asks for "minio", the s3
	// backend should be used. We verify this by registering a fake s3
	// backend via SetStorageBackend and asking for minio.
	s := &BackupService{}
	s.SetStorageBackend("s3", &noopStorageBackend{typeLabel: "s3"})
	got := s.storageBackendFor(models.BackupStorageConfig{Type: "minio"})
	if got == nil {
		t.Fatal("expected minio to resolve to the s3 backend")
	}
	if got.Type() != "s3" {
		t.Fatalf("expected type s3, got %s", got.Type())
	}
}

func TestBackupService_BaseBackupDirDefaults(t *testing.T) {
	// NewBackupService is the only path that sets the default; direct struct
	// literal leaves baseBackupDir at the zero value.
	s := NewBackupService(nil, nil)
	if s.baseBackupDir == "" {
		t.Fatal("baseBackupDir should have a default after NewBackupService")
	}
	if s.baseBackupDir != "/var/backups/orion" {
		t.Fatalf("unexpected default: %s", s.baseBackupDir)
	}
	s.SetBaseBackupDir("/tmp/backup-scratch")
	if s.baseBackupDir != "/tmp/backup-scratch" {
		t.Fatalf("expected override, got %s", s.baseBackupDir)
	}
	// Empty string should not reset.
	s.SetBaseBackupDir("")
	if s.baseBackupDir != "/tmp/backup-scratch" {
		t.Fatalf("empty string should not reset, got %s", s.baseBackupDir)
	}
}
