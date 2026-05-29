package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrConfigNotFound.Error() != "config item not found" { t.Errorf("unexpected: %s", ErrConfigNotFound.Error()) }
}
