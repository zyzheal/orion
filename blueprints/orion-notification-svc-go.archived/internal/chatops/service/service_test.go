package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrChatChannelNotFound.Error() != "channel not found" { t.Errorf("unexpected: %s", ErrChatChannelNotFound.Error()) }
}
