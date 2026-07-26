package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrSecretNotFound.Error() != "secret not found" { t.Errorf("unexpected: %s", ErrSecretNotFound.Error()) }
}
