package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrGraphNodeNotFound.Error() != "node not found" { t.Errorf("unexpected: %s", ErrGraphNodeNotFound.Error()) }
}
