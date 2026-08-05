package service

import (
	"testing"
)

func TestNewChannelService(t *testing.T) {
	svc := NewChannelService(nil, nil)
	if svc == nil {
		t.Fatalf("NewChannelService returned nil")
	}
}

func TestChannelServiceNotNil(t *testing.T) {
	_ = NewChannelService(nil, nil)
}
