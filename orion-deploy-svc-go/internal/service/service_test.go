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
