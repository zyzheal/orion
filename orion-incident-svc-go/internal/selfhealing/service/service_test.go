package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrHealingRuleNotFound.Error() != "rule not found" { t.Errorf("unexpected: %s", ErrHealingRuleNotFound.Error()) }
}
