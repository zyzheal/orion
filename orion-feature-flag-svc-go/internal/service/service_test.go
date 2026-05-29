package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrFlagNotFound.Error() != "feature flag not found" { t.Errorf("unexpected: %s", ErrFlagNotFound.Error()) }
}
