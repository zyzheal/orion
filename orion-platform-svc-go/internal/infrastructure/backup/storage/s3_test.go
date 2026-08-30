package storage

import (
	"errors"
	"testing"
)

func TestNewS3_RequiresBucket(t *testing.T) {
	_, err := NewS3(S3Config{Endpoint: "s3.amazonaws.com", AccessKey: "a", SecretKey: "b"})
	if err == nil {
		t.Fatal("expected error for missing bucket")
	}
	if err.Error() == "" {
		t.Fatal("expected descriptive error")
	}
}

func TestNewS3_RequiresAccessKey(t *testing.T) {
	_, err := NewS3(S3Config{Endpoint: "s3.amazonaws.com", Bucket: "b", SecretKey: "b"})
	if err == nil {
		t.Fatal("expected error for missing access key")
	}
}

func TestNewS3_RequiresSecretKey(t *testing.T) {
	_, err := NewS3(S3Config{Endpoint: "s3.amazonaws.com", Bucket: "b", AccessKey: "a"})
	if err == nil {
		t.Fatal("expected error for missing secret key")
	}
}

func TestNewS3_RequiresEndpoint(t *testing.T) {
	_, err := NewS3(S3Config{Bucket: "b", AccessKey: "a", SecretKey: "s"})
	if err == nil {
		t.Fatal("expected error for missing endpoint")
	}
}

func TestNewS3_HappyPathReturnsInstance(t *testing.T) {
	s, err := NewS3(S3Config{
		Endpoint:  "s3.amazonaws.com",
		Region:    "us-east-1",
		Bucket:    "mybucket",
		AccessKey: "a",
		SecretKey: "s",
		UseSSL:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if s == nil || s.bucket != "mybucket" {
		t.Fatalf("unexpected s: %+v", s)
	}
	if s.Type() != "s3" {
		t.Fatalf("expected type s3, got %s", s.Type())
	}
}

func TestS3_NormalizePathStripsLeadingSlashAndSpaces(t *testing.T) {
	s := &S3{bucket: "b"}
	cases := map[string]string{
		"/backup/2026/01.dump":  "backup/2026/01.dump",
		"  /foo":                "foo",
		"no-slash/foo":          "no-slash/foo",
		"   ":                   "",
	}
	for in, want := range cases {
		if got := s.normalizePath(in); got != want {
			t.Fatalf("normalizePath(%q) = %q, want %q", in, got, want)
		}
	}
}

// Compile-time check: S3 must implement StorageBackend.
var _ StorageBackend = (*S3)(nil)

// TestNew_UnsupportedTypeIsWrapped verifies the ErrUnsupportedBackend
// sentinel is preserved so callers can errors.Is against it.
func TestNew_UnsupportedTypeIsWrapped(t *testing.T) {
	_, err := New(Config{Type: "gcs"})
	if err == nil {
		t.Fatal("expected error for gcs")
	}
	if !errors.Is(err, ErrUnsupportedBackend) {
		t.Fatalf("expected ErrUnsupportedBackend wrap, got %v", err)
	}
}
