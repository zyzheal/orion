package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrDeploymentNotFound.Error() != "deployment not found" {
		t.Errorf("unexpected error message: %s", ErrDeploymentNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
	if ErrNoRollbackTarget.Error() != "no previous deployment found for rollback" {
		t.Errorf("unexpected error message: %s", ErrNoRollbackTarget.Error())
	}
}

func TestSafeStr(t *testing.T) {
	if got := safeStr(nil); got != "" {
		t.Errorf("expected empty string for nil, got %q", got)
	}
	s := "hello"
	if got := safeStr(&s); got != "hello" {
		t.Errorf("expected 'hello', got %q", got)
	}
}
