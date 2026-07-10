package service

import "testing"

func TestErrorConstants(t *testing.T) {
	if ErrPoolNotFound.Error() != "resource pool not found" {
		t.Errorf("unexpected ErrPoolNotFound: %s", ErrPoolNotFound.Error())
	}
	if ErrPolicyNotFound.Error() != "scaling policy not found" {
		t.Errorf("unexpected ErrPolicyNotFound: %s", ErrPolicyNotFound.Error())
	}
	if ErrForecastNotFound.Error() != "capacity forecast not found" {
		t.Errorf("unexpected ErrForecastNotFound: %s", ErrForecastNotFound.Error())
	}
}
