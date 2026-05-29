package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrDigitalTwinNotFound.Error() != "twin not found" { t.Errorf("unexpected: %s", ErrDigitalTwinNotFound.Error()) }
}
