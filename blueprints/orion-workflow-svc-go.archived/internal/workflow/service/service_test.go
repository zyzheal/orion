package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrWorkflowNotFound.Error() != "workflow not found" { t.Errorf("unexpected: %s", ErrWorkflowNotFound.Error()) }
}
