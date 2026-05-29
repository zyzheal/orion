package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrArtifactNotFound.Error() != "artifact not found" { t.Errorf("unexpected: %s", ErrArtifactNotFound.Error()) }
}
