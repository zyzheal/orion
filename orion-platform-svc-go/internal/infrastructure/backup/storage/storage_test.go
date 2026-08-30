package storage

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLocal_PutGetRoundtrip(t *testing.T) {
	base := t.TempDir()
	s := &Local{BasePath: base}

	payload := []byte("hello world backup payload")
	if err := s.Put(context.Background(), "tenant-a/plan-1/backup.dump", bytes.NewReader(payload)); err != nil {
		t.Fatalf("Put failed: %v", err)
	}

	r, err := s.Get(context.Background(), "tenant-a/plan-1/backup.dump")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	defer r.Close()
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("roundtrip mismatch: got %q want %q", got, payload)
	}
}

func TestLocal_ExistsAndSize(t *testing.T) {
	base := t.TempDir()
	s := &Local{BasePath: base}
	payload := []byte("12345")
	if err := s.Put(context.Background(), "a/b.dump", bytes.NewReader(payload)); err != nil {
		t.Fatal(err)
	}
	ok, err := s.Exists(context.Background(), "a/b.dump")
	if err != nil || !ok {
		t.Fatalf("exists failed: %v %v", ok, err)
	}
	size, err := s.Size(context.Background(), "a/b.dump")
	if err != nil || size != 5 {
		t.Fatalf("size=%d err=%v", size, err)
	}
	ok, err = s.Exists(context.Background(), "a/missing.dump")
	if err != nil || ok {
		t.Fatalf("missing should be false: %v %v", ok, err)
	}
}

func TestLocal_DeleteIsIdempotent(t *testing.T) {
	base := t.TempDir()
	s := &Local{BasePath: base}
	if err := s.Put(context.Background(), "x.dump", bytes.NewReader([]byte("x"))); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), "x.dump"); err != nil {
		t.Fatalf("first delete: %v", err)
	}
	if err := s.Delete(context.Background(), "x.dump"); err != nil {
		t.Fatalf("idempotent delete should not fail: %v", err)
	}
}

func TestLocal_RejectsAbsolutePath(t *testing.T) {
	s := &Local{BasePath: t.TempDir()}
	err := s.Put(context.Background(), "/etc/passwd", bytes.NewReader([]byte("x")))
	if err == nil {
		t.Fatal("expected absolute path to be rejected")
	}
	if !strings.Contains(err.Error(), "absolute path") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLocal_RejectsPathTraversal(t *testing.T) {
	base := t.TempDir()
	s := &Local{BasePath: base}
	err := s.Put(context.Background(), "../etc/passwd", bytes.NewReader([]byte("x")))
	if err == nil {
		t.Fatal("expected ../ traversal to be rejected")
	}
	parent := filepath.Dir(base)
	if _, err := os.Stat(filepath.Join(parent, "etc", "passwd")); err == nil {
		t.Fatal("traversal succeeded; file was written outside base")
	}
}

func TestNew_RequiresLocalBasePath(t *testing.T) {
	if _, err := New(Config{Type: "local"}); err == nil {
		t.Fatal("expected error when local base_path missing")
	}
}

func TestNew_RequiresS3Credentials(t *testing.T) {
	if _, err := New(Config{Type: "s3", Endpoint: "s3.amazonaws.com", Bucket: "b"}); err == nil {
		t.Fatal("expected error when s3 access_key missing")
	}
}

func TestNew_UnsupportedType(t *testing.T) {
	if _, err := New(Config{Type: "azure"}); err == nil {
		t.Fatal("expected error for unsupported type")
	}
}

func TestNew_DefaultsToLocal(t *testing.T) {
	s, err := New(Config{BasePath: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	if s.Type() != "local" {
		t.Fatalf("expected default local backend, got %s", s.Type())
	}
}
