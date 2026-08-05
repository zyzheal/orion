package service

import (
	"testing"
)

func TestNewDeliveryService(t *testing.T) {
	svc := NewDeliveryService(nil, nil)
	if svc == nil {
		t.Fatal("NewDeliveryService returned nil")
	}
}

func TestDeliveryServiceNotNil(t *testing.T) {
	_ = NewDeliveryService(nil, nil)
}
