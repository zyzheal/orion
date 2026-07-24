package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrRunnerNotFound.Error() != "runner not found" { t.Errorf("unexpected: %s", ErrRunnerNotFound.Error()) }
}
