package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrBuildNotFound.Error() != "build not found" {
		t.Errorf("unexpected error message: %s", ErrBuildNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
}
