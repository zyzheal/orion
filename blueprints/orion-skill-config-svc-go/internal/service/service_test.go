package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrSkillConfigNotFound.Error() != "config not found" { t.Errorf("unexpected: %s", ErrSkillConfigNotFound.Error()) }
}
