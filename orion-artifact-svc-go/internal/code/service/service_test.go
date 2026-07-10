package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrCodeRepositoryNotFound.Error() != "repository not found" { t.Errorf("unexpected: %s", ErrCodeRepositoryNotFound.Error()) }
}
