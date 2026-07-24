package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrNotificationNotFound.Error() != "notification not found" { t.Errorf("unexpected: %s", ErrNotificationNotFound.Error()) }
}
