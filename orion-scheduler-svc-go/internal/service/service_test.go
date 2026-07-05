package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrJobNotFound.Error() != "job not found" {
		t.Errorf("unexpected error message: %s", ErrJobNotFound.Error())
	}
	if ErrInvalidStatus.Error() != "invalid status transition" {
		t.Errorf("unexpected error message: %s", ErrInvalidStatus.Error())
	}
}
