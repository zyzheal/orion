package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrPolicyNotFound.Error() != "policy not found" { t.Errorf("unexpected: %s", ErrPolicyNotFound.Error()) }
}
