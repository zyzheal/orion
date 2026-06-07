package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrApprovalNotFound.Error() != "approval not found" {
		t.Errorf("unexpected error message: %s", ErrApprovalNotFound.Error())
	}
	if ErrStepNotFound.Error() != "approval step not found" {
		t.Errorf("unexpected error message: %s", ErrStepNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
	if ErrAlreadyActed.Error() != "step already acted upon" {
		t.Errorf("unexpected error message: %s", ErrAlreadyActed.Error())
	}
	if ErrNotAuthorized.Error() != "not authorized for this approval" {
		t.Errorf("unexpected error message: %s", ErrNotAuthorized.Error())
	}
}
