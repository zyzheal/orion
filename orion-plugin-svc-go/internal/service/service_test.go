package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrPluginNotFound.Error() != "plugin not found" { t.Errorf("unexpected: %s", ErrPluginNotFound.Error()) }
}
