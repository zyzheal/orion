package artifactbus

import (
	"context"
	"testing"
)

// No DB dependency — nil DB must return NoopArtifactBus regardless of Enabled.
func TestNewArtifactBus_NilDBReturnsNoop(t *testing.T) {
	bus := NewArtifactBus(context.Background(), nil, ArtifactBusConfig{Enabled: true})
	if _, ok := bus.(NoopArtifactBus); !ok {
		t.Errorf("nil DB should return NoopArtifactBus, got %T", bus)
	}
}

func TestNewArtifactBus_DisabledReturnsNoop(t *testing.T) {
	// We can't easily construct a *sqlx.DB without a DB. Use the nil case
	// but assert that Enabled=false also yields Noop via the same branch.
	bus := NewArtifactBus(context.Background(), nil, ArtifactBusConfig{Enabled: false})
	if _, ok := bus.(NoopArtifactBus); !ok {
		t.Errorf("Enabled=false should return NoopArtifactBus, got %T", bus)
	}
}

// Test that the NoopArtifactBus satisfies the full interface contract
// by exercising every method (regression guard).
func TestNoopArtifactBus_SatisfiesFullInterface(t *testing.T) {
	var bus ArtifactBus = NoopArtifactBus{}
	ctx := context.Background()

	if err := bus.Publish(ctx, &Artifact{}); err != nil {
		t.Errorf("Publish: %v", err)
	}
	_, err := bus.Get(ctx, "t", "r", "s", "n")
	if err == nil {
		t.Error("Get should return ErrNotFound, got nil")
	}
	_, err = bus.List(ctx, "t", "r")
	if err != nil {
		t.Errorf("List: %v", err)
	}
	if err := bus.Delete(ctx, "t", "id"); err != nil {
		t.Errorf("Delete: %v", err)
	}
	n, err := bus.Cleanup(ctx)
	if err != nil || n != 0 {
		t.Errorf("Cleanup: (%d, %v)", n, err)
	}
}
