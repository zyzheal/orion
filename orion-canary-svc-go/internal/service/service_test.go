package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrCanaryNotFound.Error() != "canary not found" {
		t.Errorf("unexpected error message: %s", ErrCanaryNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
}
