package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrWikiSpaceNotFound.Error() != "space not found" { t.Errorf("unexpected: %s", ErrWikiSpaceNotFound.Error()) }
}
