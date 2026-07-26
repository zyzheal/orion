package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrBuildNotFound.Error() != "build not found" {
		t.Errorf("unexpected error message: %s", ErrBuildNotFound.Error())
	}
	if ErrEnvNotFound.Error() != "build environment not found" {
		t.Errorf("unexpected error message: %s", ErrEnvNotFound.Error())
	}
	if ErrArtifactNotFound.Error() != "artifact not found" {
		t.Errorf("unexpected error message: %s", ErrArtifactNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
	if ErrInvalidInput.Error() != "invalid input" {
		t.Errorf("unexpected error message: %s", ErrInvalidInput.Error())
	}
}
