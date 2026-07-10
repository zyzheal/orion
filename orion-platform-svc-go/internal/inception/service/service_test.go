package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrInceptionProjectNotFound.Error() != "project not found" { t.Errorf("unexpected: %s", ErrInceptionProjectNotFound.Error()) }
}
