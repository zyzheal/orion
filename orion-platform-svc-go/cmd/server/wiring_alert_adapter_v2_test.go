package main

import (
	"testing"

	"go.uber.org/zap"

	aa2_handlers "orion/platform-svc-go/internal/alert-adapter-v2/service/handlers"
)

// TestWireAlertAdapterV2RegistersEveryLiveChannel is the wiring-level link in
// the chain. The handlers package tests prove RegisterLiveHandlers registers
// every working channel; this test proves production wiring actually calls it.
// Before it existed, the factory was constructed with an empty registry, so the
// /alert-adapters/v2 routes were live while every create and send failed with
// ErrNoHandler — a route that can never deliver.
func TestWireAlertAdapterV2RegistersEveryLiveChannel(t *testing.T) {
	// ff_config.Load() fatals without these; they only affect config parsing.
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)

	wireAlertAdapterV2(infra.db, logger)

	if alertAdapterV2H == nil {
		t.Fatal("wireAlertAdapterV2 left alertAdapterV2H nil")
	}

	got := alertAdapterV2H.Channels()
	if len(got) == 0 {
		t.Fatal("the wired factory has no handlers: /alert-adapters/v2 could never deliver")
	}

	want := make(map[string]bool, len(aa2_handlers.LiveChannels))
	for _, ch := range aa2_handlers.LiveChannels {
		want[ch] = true
	}
	if len(want) != len(got) {
		t.Errorf("wired channels = %v, want exactly %v", got, aa2_handlers.LiveChannels)
	}
	for _, ch := range got {
		if !want[ch] {
			t.Errorf("wired channel %q is not in handlers.LiveChannels", ch)
		}
	}
	for _, ch := range append(aa2_handlers.StubbyChannels, aa2_handlers.HandlerlessChannels...) {
		if want[ch] {
			t.Errorf("unimplemented channel %q is advertised as live", ch)
		}
	}
}
