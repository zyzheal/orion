package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrIntelligenceTaskNotFound.Error() != "task not found" { t.Errorf("unexpected: %s", ErrIntelligenceTaskNotFound.Error()) }
}
