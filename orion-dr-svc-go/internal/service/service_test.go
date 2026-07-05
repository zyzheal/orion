package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrDRPlanNotFound.Error() != "plan not found" { t.Errorf("unexpected: %s", ErrDRPlanNotFound.Error()) }
}
