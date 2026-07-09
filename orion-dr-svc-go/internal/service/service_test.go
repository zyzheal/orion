package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrDRPlanNotFound.Error() != "DR plan not found" { t.Errorf("unexpected: %s", ErrDRPlanNotFound.Error()) }
}
