package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrRuleNotFound.Error() != "inspection rule not found" { t.Errorf("unexpected: %s", ErrRuleNotFound.Error()) }
	if ErrResultNotFound.Error() != "inspection result not found" { t.Errorf("unexpected: %s", ErrResultNotFound.Error()) }
}
