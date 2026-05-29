package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrLLMModelNotFound.Error() != "model not found" { t.Errorf("unexpected: %s", ErrLLMModelNotFound.Error()) }
}
