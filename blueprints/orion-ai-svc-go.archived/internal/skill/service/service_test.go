package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrSkillNotFound.Error() != "skill not found" { t.Errorf("unexpected: %s", ErrSkillNotFound.Error()) }
}
