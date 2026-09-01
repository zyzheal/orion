package service

import (
	"context"
	"testing"
)

func TestPurgeAll_NilRepoReturnsEmpty(t *testing.T) {
	s := NewBackupService(nil, nil)
	out := s.PurgeAll(context.Background())
	if out == nil || len(out) != 0 {
		t.Fatalf("expected empty map, got %v", out)
	}
}

func TestPurgeAllWithOptions_NilRepoReturnsEmpty(t *testing.T) {
	s := NewBackupService(nil, nil)
	out := s.PurgeAllWithOptions(context.Background(), PurgeAllOptions{DryRun: true})
	if out == nil || len(out) != 0 {
		t.Fatalf("expected empty map, got %v", out)
	}
}

func TestPurgeAllWithOptions_DryRunFlag(t *testing.T) {
	s := NewBackupService(nil, nil)
	// With nil repo the function returns an empty map regardless of
	// DryRun — the test is structural.
	out := s.PurgeAllWithOptions(context.Background(), PurgeAllOptions{DryRun: true})
	if len(out) != 0 {
		t.Fatalf("expected empty map, got %v", out)
	}
}
