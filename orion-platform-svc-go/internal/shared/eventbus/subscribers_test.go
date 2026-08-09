package eventbus

import (
	"context"
	"errors"
	"testing"
)

// --- fake subscriber implementations ---

type fakeAlertTriggeredSubscriber struct{}

func (f *fakeAlertTriggeredSubscriber) HandleAlertTriggered(ctx context.Context, event StandardEvent) error {
	return nil
}

type fakeErrorSubscriber struct{}

func (f *fakeErrorSubscriber) HandleAlertTriggered(ctx context.Context, event StandardEvent) error {
	return errors.New("subscriber error")
}

type fakePipelineStartedSubscriber struct {
	called bool
}

func (f *fakePipelineStartedSubscriber) HandlePipelineStarted(ctx context.Context, event StandardEvent) error {
	f.called = true
	return nil
}

// --- tests ---

func TestRegisterAlertTriggered(t *testing.T) {
	s := &fakeAlertTriggeredSubscriber{}
	handler := RegisterAlertTriggered(s)
	err := handler(context.Background(), StandardEvent{Type: EventAlertTriggered})
	if err != nil {
		t.Fatalf("RegisterAlertTriggered handler returned error: %v", err)
	}
}

func TestRegisterAlertTriggeredReturnsError(t *testing.T) {
	s := &fakeErrorSubscriber{}
	handler := RegisterAlertTriggered(s)
	err := handler(context.Background(), StandardEvent{Type: EventAlertTriggered})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err.Error() != "subscriber error" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRegisterPipelineStarted(t *testing.T) {
	s := &fakePipelineStartedSubscriber{}
	handler := RegisterPipelineStarted(s)
	err := handler(context.Background(), StandardEvent{Type: EventPipelineStarted})
	if err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if !s.called {
		t.Fatal("expected subscriber to be called")
	}
}

func TestEventBusWithSubscriberAdapter(t *testing.T) {
	bus := NewEventBus()
	s := &fakeAlertTriggeredSubscriber{}
	bus.Subscribe(EventAlertTriggered, RegisterAlertTriggered(s))
	err := bus.Publish(context.Background(), StandardEvent{Type: EventAlertTriggered})
	if err != nil {
		t.Fatalf("Publish() returned error: %v", err)
	}
}
