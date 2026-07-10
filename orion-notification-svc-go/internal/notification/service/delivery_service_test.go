package service

import (
	"testing"
	"time"

	"orion/notification-svc-go/internal/notification/models"
)

func TestDeliveryServiceErrors(t *testing.T) {
	if ErrDeliveryNotFound.Error() != "delivery not found" {
		t.Errorf("unexpected ErrDeliveryNotFound message: %s", ErrDeliveryNotFound.Error())
	}
}

func TestCalculateNextRetry(t *testing.T) {
	now := time.Now()
	tests := []struct {
		attempt int
		minDiff  int64
		maxDiff  int64
	}{
		{1, 25_000, 35_000},   // ~30s
		{2, 290_000, 310_000}, // ~5min
		{3, 1_790_000, 1_810_000}, // ~30min
		{10, 1_790_000, 1_810_000}, // capped at max
		{0, 25_000, 35_000},   // treated as attempt 1
	}

	for _, tt := range tests {
		got := CalculateNextRetry(tt.attempt)
		diff := got.Sub(now).Milliseconds()
		if diff < tt.minDiff || diff > tt.maxDiff {
			t.Errorf("CalculateNextRetry(%d) diff=%dms, want ~%dms", tt.attempt, diff, (tt.minDiff+tt.maxDiff)/2)
		}
	}
}

func TestResolveFallbackChannel(t *testing.T) {
	tests := []struct {
		channel   models.DeliveryChannel
		wantNil  bool
		wantCh   models.DeliveryChannel
	}{
		{models.DeliveryChannelEmail, false, models.DeliveryChannelPush},
		{models.DeliveryChannelSMS, false, models.DeliveryChannelWebhook},
		{models.DeliveryChannelWebhook, false, models.DeliveryChannelInApp},
		{models.DeliveryChannelPush, false, models.DeliveryChannelInApp},
		{models.DeliveryChannelInApp, true, ""},
	}

	for _, tt := range tests {
		got := ResolveFallbackChannel(tt.channel)
		if tt.wantNil {
			if got != nil {
				t.Errorf("ResolveFallbackChannel(%s) = %v, want nil", tt.channel, *got)
			}
		} else {
			if got == nil || *got != tt.wantCh {
				t.Errorf("ResolveFallbackChannel(%s) = %v, want %s", tt.channel, *got, tt.wantCh)
			}
		}
	}
}

func TestDeliveryStatusConstants(t *testing.T) {
	expected := map[models.DeliveryStatus]bool{
		models.DeliveryStatusPending:   true,
		models.DeliveryStatusSent:      true,
		models.DeliveryStatusFailed:    true,
		models.DeliveryStatusRetrying:  true,
		models.DeliveryStatusExhausted: true,
	}
	for status, _ := range expected {
		if string(status) == "" {
			t.Errorf("empty delivery status constant")
		}
	}
}

func TestDeliveryChannelConstants(t *testing.T) {
	expected := []models.DeliveryChannel{
		models.DeliveryChannelEmail,
		models.DeliveryChannelSMS,
		models.DeliveryChannelWebhook,
		models.DeliveryChannelPush,
		models.DeliveryChannelInApp,
	}
	for _, ch := range expected {
		if string(ch) == "" {
			t.Errorf("empty delivery channel constant")
		}
	}
}
