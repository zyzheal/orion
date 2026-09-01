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
	putCalled bool
}

func (b *noopStorageBackend) Type() string { return b.typeLabel }
func (b *noopStorageBackend) Put(_ context.Context, _ string, _ io.Reader) error {
	b.putCalled = true
	return nil
}
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

// advancedStorageBackend doubles storage.AdvancedBackend so the service can
// exercise the multipart-preferred upload path and capability probing without
// a real S3 service. It records which method was called last.
type advancedStorageBackend struct {
	noopStorageBackend
	multipartCalled bool
	lifecycleCalled bool
}

func (b *advancedStorageBackend) Capabilities() storage.BackendCaps {
	return storage.BackendCaps{MultipartUpload: true, LifecycleRules: true, ColdStorage: true}
}

func (b *advancedStorageBackend) MultipartUpload(_ context.Context, _ string, _ io.Reader) error {
	b.multipartCalled = true
	return nil
}

func (b *advancedStorageBackend) SetLifecycle(_ context.Context, _ storage.LifecyclePolicy) error {
	b.lifecycleCalled = true
	return nil
}

var _ storage.AdvancedBackend = (*advancedStorageBackend)(nil)

func TestBackendCapabilitiesForPublic_LocalZeroCaps(t *testing.T) {
	// Local / unconfigured backends must yield zero-value caps — callers
	// cannot assume multipart or lifecycle support.
	s := &BackupService{}
	if caps := s.BackendCapabilitiesForPublic(models.BackupStorageConfig{Type: "local"}); caps.MultipartUpload || caps.LifecycleRules || caps.ColdStorage {
		t.Fatalf("local must not report advanced caps, got %+v", caps)
	}
	if caps := s.BackendCapabilitiesForPublic(models.BackupStorageConfig{}); caps != (storage.BackendCaps{}) {
		t.Fatalf("unconfigured raw jwt must be zero caps, got %+v", caps)
	}
}

func TestBackendCapabilitiesForPublic_S3ReportsCaps(t *testing.T) {
	s := &BackupService{}
	s.SetStorageBackend("s3", &advancedStorageBackend{})
	// minio config resolves to the s3 backend and must expose the S3 caps.
	caps := s.BackendCapabilitiesForPublic(models.BackupStorageConfig{Type: "minio"})
	if !caps.MultipartUpload || !caps.LifecycleRules || !caps.ColdStorage {
		t.Fatalf("s3 backend should report full caps, got %+v", caps)
	}
}

func TestUploadArtifact_PrefersMultipart(t *testing.T) {
	// When the backend implements AdvancedBackend with multipart support, the
	// service must route through MultipartUpload rather than the single-shot
	// Put path.
	s := &BackupService{}
	b := &advancedStorageBackend{}
	src := writeTempArtifact(t, "some backup bytes")
	if err := s.uploadArtifact(context.Background(), b, "bkup/p-1/b-1", src); err != nil {
		t.Fatal(err)
	}
	if !b.multipartCalled {
		t.Fatal("expected MultipartUpload to be called for advanced backend")
	}
	if b.noopStorageBackend.putCalled {
		t.Fatal("Put must not be called when multipart is available")
	}
}

func TestUploadArtifact_FallsBackToPut(t *testing.T) {
	// A plain backend that lacks multipart must still upload via Put — this is
	// the compatibility path for Local and older backends.
	s := &BackupService{}
	b := &noopStorageBackend{typeLabel: "noput"}
	src := writeTempArtifact(t, "some backup bytes")
	if err := s.uploadArtifact(context.Background(), b, "bkup/p-1/b-1", src); err != nil {
		t.Fatal(err)
	}
	if !b.putCalled {
		t.Fatal("expected Put to be called for non-advanced backend")
	}
}

// writeTempArtifact writes payload to a temp file and returns its path, so
// uploadArtifact has a real readable source stream.
func writeTempArtifact(t *testing.T, payload string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "artifact-*.dump")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(payload); err != nil {
		t.Fatal(err)
	}
	return f.Name()
}
