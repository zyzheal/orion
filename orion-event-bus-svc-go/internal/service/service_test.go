package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrEventTopicNotFound.Error() != "topic not found" { t.Errorf("unexpected: %s", ErrEventTopicNotFound.Error()) }
}
