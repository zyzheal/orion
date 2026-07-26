package service

import (
	"testing"
)

func TestOrDefault(t *testing.T) {
	if got := orDefault("hello", "default"); got != "hello" {
		t.Errorf("expected 'hello', got '%s'", got)
	}
	if got := orDefault("", "default"); got != "default" {
		t.Errorf("expected 'default', got '%s'", got)
	}
}

func TestSentinelErrors(t *testing.T) {
	if ErrSkillNotFound.Error() != "skill not found" {
		t.Errorf("unexpected message: %s", ErrSkillNotFound.Error())
	}
	if ErrInvalidInput.Error() != "invalid input" {
		t.Errorf("unexpected message: %s", ErrInvalidInput.Error())
	}
	if ErrInvalidRating.Error() != "rating must be between 1 and 5" {
		t.Errorf("unexpected message: %s", ErrInvalidRating.Error())
	}
	if ErrDuplicateName.Error() != "skill name already exists" {
		t.Errorf("unexpected message: %s", ErrDuplicateName.Error())
	}
	if ErrRejectionReasonReq.Error() != "rejection reason is required" {
		t.Errorf("unexpected message: %s", ErrRejectionReasonReq.Error())
	}
}
