package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrContributionNotFound.Error() != "contribution not found" { t.Errorf("unexpected: %s", ErrContributionNotFound.Error()) }
}
