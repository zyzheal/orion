package service

import (
	"context"
	"testing"
)

func TestPurgeExpired_RequiresTenantID(t *testing.T) {
	s := NewBackupService(nil, nil)
	if _, err := s.PurgeExpired(context.Background(), ""); err == nil {
		t.Fatal("expected error for empty tenant")
	}
}

func TestPurgeExpired_RequiresRepo(t *testing.T) {
	s := NewBackupService(nil, nil)
	if _, err := s.PurgeExpired(context.Background(), "t1"); err == nil {
		t.Fatal("expected error when repo is nil")
	}
}

func TestStartRetentionCron_EmptyScheduleNoop(t *testing.T) {
	s := NewBackupService(nil, nil)
	if got := s.StartRetentionCron(""); got != -1 {
		t.Fatalf("expected -1 for empty schedule, got %d", got)
	}
}

func TestStartRetentionCron_NilSchedulerNoop(t *testing.T) {
	s := NewBackupService(nil, nil)
	s.scheduler = nil
	if got := s.StartRetentionCron("0 30 2 * * *"); got != -1 {
		t.Fatalf("expected -1 when scheduler is nil, got %d", got)
	}
}
