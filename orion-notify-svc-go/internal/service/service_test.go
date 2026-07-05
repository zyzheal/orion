package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrNotifyTemplateNotFound.Error() != "template not found" { t.Errorf("unexpected: %s", ErrNotifyTemplateNotFound.Error()) }
}
