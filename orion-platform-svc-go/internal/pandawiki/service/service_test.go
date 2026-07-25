package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrNotFound.Error() != "not found" {
		t.Errorf("unexpected: %s", ErrNotFound.Error())
	}
}
