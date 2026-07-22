package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrRiskItemNotFound.Error() != "risk not found" { t.Errorf("unexpected: %s", ErrRiskItemNotFound.Error()) }
}
