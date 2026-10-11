package artifactbus

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"reflect"
	"testing"
	"time"
)

// noopBus() is a helper to avoid the composite-literal-then-method-call
// syntax that Go parses as an assignment target.
func noopBus() NoopArtifactBus { return NoopArtifactBus{} }

func TestNoop_PublishSilentNoOp(t *testing.T) {
	ctx := context.Background()
	a := &Artifact{
		TenantID:      "t1",
		PipelineRunID: "r1",
		StageID:       "s1",
		Name:          "n1",
		ContentType:   "application/octet-stream",
		Content:       []byte("hello"),
	}
	if err := noopBus().Publish(ctx, a); err != nil {
		t.Fatalf("Noop.Publish should return nil, got %v", err)
	}
}

func TestNoop_GetReturnsNotFound(t *testing.T) {
	_, err := noopBus().Get(context.Background(), "t", "r", "s", "n")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestNoop_ListReturnsEmpty(t *testing.T) {
	got, err := noopBus().List(context.Background(), "t", "r")
	if err != nil {
		t.Fatalf("Noop.List should return nil error, got %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

func TestNoop_DeleteAndCleanupSilent(t *testing.T) {
	if err := noopBus().Delete(context.Background(), "t", "id"); err != nil {
		t.Errorf("Noop.Delete should return nil, got %v", err)
	}
	n, err := noopBus().Cleanup(context.Background())
	if err != nil || n != 0 {
		t.Errorf("Noop.Cleanup should return (0, nil), got (%d, %v)", n, err)
	}
}

func TestNew_ComputesChecksumAndSize(t *testing.T) {
	content := []byte("hello world")
	a := &Artifact{Content: content}
	if err := New(a, DefaultMaxSize); err != nil {
		t.Fatalf("New: %v", err)
	}
	if a.SizeBytes != int64(len(content)) {
		t.Errorf("SizeBytes = %d, want %d", a.SizeBytes, len(content))
	}
	expected := sha256.Sum256(content)
	if a.Checksum != hex.EncodeToString(expected[:]) {
		t.Errorf("Checksum = %s, want %s", a.Checksum, hex.EncodeToString(expected[:]))
	}
	if a.Metadata == nil {
		t.Error("Metadata should be normalized to empty map, got nil")
	}
	if len(a.Metadata) != 0 {
		t.Errorf("Metadata should be empty map, got %v", a.Metadata)
	}
}

func TestNew_DefaultExpiresAt(t *testing.T) {
	before := time.Now().UTC().Add(-time.Second)
	a := &Artifact{Content: []byte("x")}
	if err := New(a, DefaultMaxSize); err != nil {
		t.Fatalf("New: %v", err)
	}
	if a.CreatedAt.Before(before) || a.CreatedAt.After(time.Now().UTC().Add(time.Second)) {
		t.Errorf("CreatedAt out of range: %v", a.CreatedAt)
	}
	expected := a.CreatedAt.Add(DefaultTTL)
	if !a.ExpiresAt.Equal(expected) {
		t.Errorf("ExpiresAt = %v, want %v", a.ExpiresAt, expected)
	}
}

func TestNew_HonorsExistingTimestamps(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	expires := created.Add(10 * time.Hour)
	a := &Artifact{Content: []byte("x"), CreatedAt: created, ExpiresAt: expires}
	if err := New(a, DefaultMaxSize); err != nil {
		t.Fatalf("New: %v", err)
	}
	if !a.CreatedAt.Equal(created) || !a.ExpiresAt.Equal(expires) {
		t.Errorf("timestamps overwritten: CreatedAt=%v ExpiresAt=%v", a.CreatedAt, a.ExpiresAt)
	}
}

func TestNew_NilArtifact(t *testing.T) {
	err := New(nil, DefaultMaxSize)
	if err == nil {
		t.Error("expected error for nil artifact")
	}
}

func TestNew_NilMetadataNormalized(t *testing.T) {
	a := &Artifact{Content: []byte("x")}
	a.Metadata = nil
	if err := New(a, DefaultMaxSize); err != nil {
		t.Fatalf("New: %v", err)
	}
	if a.Metadata == nil {
		t.Error("Metadata should not be nil after New")
	}
	if len(a.Metadata) != 0 {
		t.Errorf("Metadata should be empty map, got %v", a.Metadata)
	}
}

func TestNew_SizeLimit(t *testing.T) {
	a := &Artifact{Content: []byte("hello")} // 5 bytes
	err := New(a, 4) // maxSize=4
	if !errors.Is(err, ErrArtifactTooLarge) {
		t.Errorf("expected ErrArtifactTooLarge, got %v", err)
	}
}

func TestNew_FallsBackToDefaultSizeOnZero(t *testing.T) {
	a := &Artifact{Content: make([]byte, 1000)}
	if err := New(a, 0); err != nil {
		t.Errorf("New with maxSize=0 should fall back to DefaultMaxSize, got %v", err)
	}
}

func TestEncodeMetadata_Nil(t *testing.T) {
	b, err := EncodeMetadata(nil)
	if err != nil {
		t.Fatalf("EncodeMetadata(nil): %v", err)
	}
	if string(b) != "{}" {
		t.Errorf("expected '{}', got %q", string(b))
	}
}

func TestEncodeMetadata_Empty(t *testing.T) {
	b, err := EncodeMetadata(map[string]any{})
	if err != nil {
		t.Fatalf("EncodeMetadata(empty): %v", err)
	}
	if string(b) != "{}" {
		t.Errorf("expected '{}', got %q", string(b))
	}
}

func TestEncodeMetadata_Populated(t *testing.T) {
	b, err := EncodeMetadata(map[string]any{
		"producer": "build",
		"version":  "1.2.3",
		"count":    42,
	})
	if err != nil {
		t.Fatalf("EncodeMetadata: %v", err)
	}
	if len(b) == 0 {
		t.Error("expected non-empty JSON")
	}
}

func TestDecodeMetadata_NilBytes(t *testing.T) {
	m, err := DecodeMetadata(nil)
	if err != nil {
		t.Fatalf("DecodeMetadata(nil): %v", err)
	}
	if m != nil {
		t.Errorf("expected nil map for nil bytes, got %v", m)
	}
}

func TestDecodeMetadata_EmptyBytes(t *testing.T) {
	m, err := DecodeMetadata([]byte{})
	if err != nil {
		t.Fatalf("DecodeMetadata(empty): %v", err)
	}
	if m != nil {
		t.Errorf("expected nil map for empty bytes, got %v", m)
	}
}

func TestDecodeMetadata_RoundTrip(t *testing.T) {
	original := map[string]any{
		"producer": "build",
		"version":  "1.2.3",
		"nested":   map[string]any{"ok": true},
	}
	b, err := EncodeMetadata(original)
	if err != nil {
		t.Fatalf("EncodeMetadata: %v", err)
	}
	got, err := DecodeMetadata(b)
	if err != nil {
		t.Fatalf("DecodeMetadata: %v", err)
	}
	if !reflect.DeepEqual(original, got) {
		t.Errorf("round-trip mismatch:\n  original=%v\n  got=%v", original, got)
	}
}

func TestArtifactBusInterface_SatisfiedByBoth(t *testing.T) {
	var _ ArtifactBus = NoopArtifactBus{}
	var _ ArtifactBus = (*PGArtifactBus)(nil) // compile-time only, not executed
}

func TestDefaultMaxSize_IsTenMiB(t *testing.T) {
	want := int64(10 * 1024 * 1024)
	if DefaultMaxSize != want {
		t.Errorf("DefaultMaxSize = %d, want %d", DefaultMaxSize, want)
	}
}

func TestDefaultTTL_IsSevenDays(t *testing.T) {
	want := 7 * 24 * time.Hour
	if DefaultTTL != want {
		t.Errorf("DefaultTTL = %v, want %v", DefaultTTL, want)
	}
}
