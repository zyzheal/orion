package storage

// MinIO real-storage end-to-end test (Phase 7, Wave 7-D). This test boots the
// actual S3-compatible backend exported by this package against a live MinIO
// server and exercises the full StorageBackend contract + G8 advanced surface
// (multipart upload, lifecycle ruleSet, capabilities).
//
// Gate: the test skips unless MINIO_E2E_* env vars are set. In CI the
// go-integration job starts a minio service container and passes the endpoint
// through env, exactly like the existing postgres/redis services.
//
//   MINIO_E2E_ENDPOINT   e.g. "localhost:9000"
//   MINIO_E2E_ACCESS_KEY default "minioadmin"
//   MINIO_E2E_SECRET_KEY default "minioadmin"
//   MINIO_E2E_BUCKET     default "backup-e2e"
//
// Run against a local container:
//   docker run -d -p 9000:9000 -p 9001:9001 \
//     -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
//     --name orion-minio-e2e minio/minio server /data --console-address ":9001"
//   MINIO_E2E_ENDPOINT=localhost:9000 go test ./internal/infrastructure/backup/storage/ -run TestS3E2E

import (
	"bytes"
	"context"
	"io"
	"os"
	"testing"
	"time"

	"github.com/minio/minio-go/v7"
)

func s3E2EConfig(t *testing.T) (S3Config, bool) {
	t.Helper()
	endpoint := os.Getenv("MINIO_E2E_ENDPOINT")
	if endpoint == "" {
		t.Skip("MINIO_E2E_ENDPOINT not set; skipping MinIO e2e (set to localhost:9000 and run a minio container to enable)")
	}
	access := os.Getenv("MINIO_E2E_ACCESS_KEY")
	if access == "" {
		access = "minioadmin"
	}
	secret := os.Getenv("MINIO_E2E_SECRET_KEY")
	if secret == "" {
		secret = "minioadmin"
	}
	bucket := os.Getenv("MINIO_E2E_BUCKET")
	if bucket == "" {
		bucket = "backup-e2e"
	}
	return S3Config{
		Endpoint:  endpoint,
		Region:    "us-east-1",
		Bucket:    bucket,
		AccessKey: access,
		SecretKey: secret,
		UseSSL:    false,
	}, true
}

// ensureS3E2EBucket creates the test bucket on the live server. MinIO does
// not auto-create buckets, so tests provision theirs like production wiring
// would (the real S3 path is expected to have the bucket pre-exist).
func ensureS3E2EBucket(t *testing.T, backend *S3) {
	t.Helper()
	if backend.client == nil {
		t.Fatal("expected s3 client to be initialized")
	}
	ctx := context.Background()
	exists, err := backend.client.BucketExists(ctx, backend.bucket)
	if err != nil {
		t.Fatalf("BucketExists: %v", err)
	}
	if exists {
		return
	}
	if err := backend.client.MakeBucket(ctx, backend.bucket, minio.MakeBucketOptions{Region: "us-east-1"}); err != nil {
		t.Fatalf("MakeBucket: %v", err)
	}
}

// TestS3E2E_SingleObjectRoundtrip is the core byte-movement contract: put a
// stream, read it back, verify size/checksum, re-upload, delete. This is the
// exact path BackupService.uploadArtifact + Verifier rely on.
func TestS3E2E_SingleObjectRoundtrip(t *testing.T) {
	cfg, ok := s3E2EConfig(t)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	backend, err := NewS3(cfg)
	if err != nil {
		t.Fatalf("NewS3: %v", err)
	}
	ensureS3E2EBucket(t, backend)
	if backend.Type() != "s3" {
		t.Fatalf("type = %q", backend.Type())
	}

	key := "e2e/" + t.Name() + ".dump"
	payload := []byte("orion-minio-e2e-single-object-roundtrip")

	if err := backend.Put(ctx, key, bytes.NewReader(payload)); err != nil {
		t.Fatalf("Put: %v", err)
	}
	defer backend.Delete(context.Background(), key) // best-effort cleanup

	sz, err := backend.Size(ctx, key)
	if err != nil {
		t.Fatalf("Size: %v", err)
	}
	if int(sz) != len(payload) {
		t.Fatalf("size = %d, want %d", sz, len(payload))
	}

	rc, err := backend.Get(ctx, key)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	rc.Close()

	if !bytes.Equal(got, payload) {
		t.Fatalf("roundtrip mismatch: got %q want %q", got, payload)
	}

	exists, err := backend.Exists(ctx, key)
	if err != nil {
		t.Fatalf("Exists: %v", err)
	}
	if !exists {
		t.Fatal("Exists = false, want true")
	}

	// Overwrite (implicit) must replace prior bytes.
	v2 := []byte("overwritten-payload")
	if err := backend.Put(ctx, key, bytes.NewReader(v2)); err != nil {
		t.Fatalf("Put(overwrite): %v", err)
	}
	rc2, err := backend.Get(ctx, key)
	if err != nil {
		t.Fatalf("Get(after overwrite): %v", err)
	}
	got2, _ := io.ReadAll(rc2)
	rc2.Close()
	if !bytes.Equal(got2, v2) {
		t.Fatalf("overwrite failed: got %q", got2)
	}

	if err := backend.Delete(ctx, key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if e, _ := backend.Exists(context.Background(), key); e {
		t.Fatal("object still exists after Delete")
	}
}

// TestS3E2E_LargePayloadMultipart exercises the G8 multipart path the way
// uploadArtifact prefers it: a payload larger than the single-PUT threshold
// streamed through AdvancedBackend.MultipartUpload. 8 MiB payload forces
// server-side multipart (minio default part size is 5 MiB).
func TestS3E2E_LargePayloadMultipart(t *testing.T) {
	cfg, ok := s3E2EConfig(t)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	backend, err := NewS3(cfg)
	if err != nil {
		t.Fatalf("NewS3: %v", err)
	}
	ensureS3E2EBucket(t, backend)
	var sb StorageBackend = backend
	adv, ok := sb.(AdvancedBackend)
	if !ok {
		t.Fatal("S3 must implement AdvancedBackend")
	}
	if !adv.Capabilities().MultipartUpload {
		t.Fatal("S3 must report MultipartUpload capability")
	}

	key := "e2e/" + t.Name() + ".dump"
	// >5 MiB so the minio client splits into multiple server-side parts.
	payload := bytes.Repeat([]byte("0123456789abcdef"), 600*1024) // ~9.6 MiB

	if err := adv.MultipartUpload(ctx, key, bytes.NewReader(payload)); err != nil {
		t.Fatalf("MultipartUpload: %v", err)
	}
	defer backend.Delete(context.Background(), key)

	sz, err := backend.Size(ctx, key)
	if err != nil {
		t.Fatalf("Size: %v", err)
	}
	if int(sz) != len(payload) {
		t.Fatalf("size = %d, want %d", sz, len(payload))
	}

	rc, err := backend.Get(ctx, key)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	rc.Close()
	if !bytes.Equal(got, payload) {
		t.Fatal("multipart roundtrip mismatch")
	}
}

// TestS3E2E_LifecycleRuleSet verifies a real SetLifecycle call against the
// live server succeeds for a valid retention policy and that the pure
// LifecycleRuleSet helper rejects a no-op before reaching the wire.
func TestS3E2E_LifecycleRuleSet(t *testing.T) {
	cfg, ok := s3E2EConfig(t)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	backend, err := NewS3(cfg)
	if err != nil {
		t.Fatalf("NewS3: %v", err)
	}
	ensureS3E2EBucket(t, backend)
	var sb StorageBackend = backend
	adv, ok := sb.(AdvancedBackend)
	if !ok {
		t.Fatal("S3 must implement AdvancedBackend")
	}

	policy := LifecyclePolicy{
		ID:              "e2e-retain-1d",
		Prefix:          "e2e/",
		ExpireAfterDays: 1,
	}
	if err := adv.SetLifecycle(ctx, policy); err != nil {
		t.Fatalf("SetLifecycle: %v", err)
	}

	// A no-op policy must be rejected before touching the server.
	if _, err := LifecycleRuleSet([]LifecyclePolicy{{ID: "noop"}}); err != ErrLifecycleNoop {
		t.Fatalf("expected ErrLifecycleNoop, got %v", err)
	}
}