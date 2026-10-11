package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"orion/platform-svc-go/internal/pipeline/artifactbus"
)

// stubBus records Publish calls for test assertions.
type stubBus struct {
	artifactbus.NoopArtifactBus
	published int64
	err       error
}

func (s *stubBus) Publish(_ context.Context, _ *artifactbus.Artifact) error {
	atomic.AddInt64(&s.published, 1)
	return s.err
}

func newTestExecutor() *StageExecutor {
	// repo is nil — PublishOutputs doesn't touch the repo.
	return &StageExecutor{}
}

func TestStageExecutor_WithArtifactBus_NilIsNoOp(t *testing.T) {
	s := newTestExecutor()
	s.WithArtifactBus(nil)
	if s.ArtifactBus() != nil {
		t.Error("ArtifactBus() should be nil after WithArtifactBus(nil)")
	}
}

func TestStageExecutor_WithArtifactBus_NonNilIsSet(t *testing.T) {
	s := newTestExecutor()
	bus := artifactbus.NoopArtifactBus{}
	s.WithArtifactBus(bus)
	if s.ArtifactBus() == nil {
		t.Error("ArtifactBus() should return the set bus")
	}
}

func TestStageExecutor_WithArtifactBus_Chainable(t *testing.T) {
	s := newTestExecutor()
	bus := artifactbus.NoopArtifactBus{}
	ret := s.WithArtifactBus(bus)
	if ret != s {
		t.Error("WithArtifactBus should return the same executor (chainable)")
	}
}

func TestPublishOutputs_NilBusReturnsZero(t *testing.T) {
	s := newTestExecutor()
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task",
		map[string]string{"a": "1"})
	if err != nil {
		t.Errorf("nil bus should return nil error, got %v", err)
	}
	if n != 0 {
		t.Errorf("nil bus should return 0, got %d", n)
	}
}

func TestPublishOutputs_EmptyOutputsReturnsZero(t *testing.T) {
	s := newTestExecutor()
	s.WithArtifactBus(&stubBus{})
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task", nil)
	if err != nil {
		t.Errorf("empty outputs should return nil error, got %v", err)
	}
	if n != 0 {
		t.Errorf("empty outputs should return 0, got %d", n)
	}
}

func TestPublishOutputs_PublishesEachOutput(t *testing.T) {
	s := newTestExecutor()
	bus := &stubBus{}
	s.WithArtifactBus(bus)
	outputs := map[string]string{
		"binary":  "BINARY_CONTENT",
		"report":  "REPORT_CONTENT",
		"summary": "SUMMARY_CONTENT",
	}
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task", outputs)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if n != len(outputs) {
		t.Errorf("published %d, want %d", n, len(outputs))
	}
}

func TestPublishOutputs_FirstErrorIsReturned(t *testing.T) {
	s := newTestExecutor()
	wantErr := errors.New("publish failed")
	bus := &stubBus{err: wantErr}
	s.WithArtifactBus(bus)
	outputs := map[string]string{"a": "1", "b": "2"}
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task", outputs)
	if err == nil {
		t.Error("expected error")
	}
	if !errors.Is(err, wantErr) {
		t.Errorf("expected errors.Is(err, wantErr), got %v", err)
	}
	// All outputs were attempted (stub always fails).
	if n != 0 {
		t.Errorf("published %d, want 0 (all failed)", n)
	}
}

func TestPublishOutputs_ArtifactBusAccessor(t *testing.T) {
	s := newTestExecutor()
	bus := artifactbus.NoopArtifactBus{}
	s.WithArtifactBus(bus)
	got := s.ArtifactBus()
	if got == nil {
		t.Error("ArtifactBus() returned nil")
	}
	// Verify it's the same interface value.
	if _, ok := got.(artifactbus.NoopArtifactBus); !ok {
		t.Errorf("ArtifactBus() returned %T, want NoopArtifactBus", got)
	}
}

func TestPublishOutputs_NilOutputsSafe(t *testing.T) {
	s := newTestExecutor()
	s.WithArtifactBus(&stubBus{})
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task", nil)
	if err != nil {
		t.Errorf("nil outputs should return nil error, got %v", err)
	}
	if n != 0 {
		t.Errorf("nil outputs should return 0, got %d", n)
	}
}

func TestPublishOutputs_ContinuesAfterError(t *testing.T) {
	// A bus that fails on the first call but succeeds on the rest.
	// This tests that PublishOutputs doesn't abort the loop on first error.
	s := newTestExecutor()
	calls := 0
	bus := &failingOnFirstBus{calls: &calls}
	s.WithArtifactBus(bus)
	outputs := map[string]string{"a": "1", "b": "2"}
	n, err := s.PublishOutputs(context.Background(), "t", "r", "s", "task", outputs)
	if err == nil {
		t.Error("expected error (first call fails)")
	}
	// Both outputs should have been attempted; one should have succeeded.
	if n != 1 {
		t.Errorf("published %d, want 1 (one success, one failure)", n)
	}
}

// failingOnFirstBus fails on the first Publish, succeeds on the rest.
type failingOnFirstBus struct {
	artifactbus.NoopArtifactBus
	calls *int
}

func (b *failingOnFirstBus) Publish(_ context.Context, _ *artifactbus.Artifact) error {
	(*b.calls)++
	if *b.calls == 1 {
		return errors.New("first call fails")
	}
	return nil
}
