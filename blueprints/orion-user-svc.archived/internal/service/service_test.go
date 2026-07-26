package service

import (
	"testing"
)

func TestServiceErrors(t *testing.T) {
	if ErrUserNotFound.Error() != "user not found" {
		t.Errorf("expected 'user not found', got %s", ErrUserNotFound.Error())
	}
	if ErrRoleNotFound.Error() != "role not found" {
		t.Errorf("expected 'role not found', got %s", ErrRoleNotFound.Error())
	}
}
