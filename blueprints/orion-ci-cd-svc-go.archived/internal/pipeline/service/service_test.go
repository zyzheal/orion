package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrPipelineNotFound.Error() != "pipeline not found" {
		t.Errorf("unexpected error message: %s", ErrPipelineNotFound.Error())
	}
	if ErrRunNotFound.Error() != "pipeline run not found" {
		t.Errorf("unexpected error message: %s", ErrRunNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
}
