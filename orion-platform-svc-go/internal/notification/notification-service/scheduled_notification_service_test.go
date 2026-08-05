package service

import (
	"testing"
)

func TestNewScheduledNotificationService(t *testing.T) {
	svc := NewScheduledNotificationService(nil, nil)
	if svc == nil {
		t.Fatalf("NewScheduledNotificationService returned nil")
	}
}

func TestScheduledNotificationServiceNotNil(t *testing.T) {
	_ = NewScheduledNotificationService(nil, nil)
}
