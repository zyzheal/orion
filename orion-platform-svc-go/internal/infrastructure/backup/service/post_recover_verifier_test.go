package service

import (
	"context"
	"testing"
)

func TestVerifyRecovery_NoRepoReturnsFailed(t *testing.T) {
	s := NewRecoveryService(nil, nil)
	res, err := s.VerifyRecovery(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != "failed" {
		t.Fatalf("expected failed status for nil repo, got %q", res.Status)
	}
}

func TestVerifyRecovery_EmptyRecoveryIDNotFatal(t *testing.T) {
	// With no repo the function should still return a structured result,
	// not panic.
	s := NewRecoveryService(nil, nil)
	res, err := s.VerifyRecovery(context.Background(), "", "")
	if err != nil {
		t.Fatal(err)
	}
	if res == nil || res.Status == "" {
		t.Fatal("expected structured result")
	}
}
