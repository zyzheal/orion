package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrSubscriptionNotFound.Error() != "subscription not found" {
		t.Errorf("unexpected: %s", ErrSubscriptionNotFound.Error())
	}
}
