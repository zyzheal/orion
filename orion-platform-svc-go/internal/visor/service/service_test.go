package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrDashboardNotFound.Error() != "dashboard not found" {
		t.Errorf("unexpected: %s", ErrDashboardNotFound.Error())
	}
}
