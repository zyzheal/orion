package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrBudgetAlertNotFound.Error() != "budget alert not found" {
		t.Errorf("unexpected error message: %s", ErrBudgetAlertNotFound.Error())
	}
	if ErrInvalidThreshold.Error() != "invalid threshold percentage" {
		t.Errorf("unexpected error message: %s", ErrInvalidThreshold.Error())
	}
}
