package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrLowCodeAppNotFound.Error() != "app not found" { t.Errorf("unexpected: %s", ErrLowCodeAppNotFound.Error()) }
}
