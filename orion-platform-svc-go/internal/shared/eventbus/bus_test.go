package eventbus

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestNewEventBus(t *testing.T) {
	bus := NewEventBus()
	if bus == nil {
		t.Fatal("NewEventBus() returned nil")
	}
	if len(bus.subscribers) != 0 {
		t.Fatalf("expected 0 subscribers, got %d", len(bus.subscribers))
	}
}

func TestSubscribe(t *testing.T) {
	bus := NewEventBus()
	bus.Subscribe(EventAlertTriggered, func(ctx context.Context, event StandardEvent) error {
		return nil
	})
	if bus.SubscriberCount(EventAlertTriggered) != 1 {
		t.Fatalf("expected 1 subscriber, got %d", bus.SubscriberCount(EventAlertTriggered))
	}
}

func TestSubscribeMultipleHandlers(t *testing.T) {
	bus := NewEventBus()
	count := 0
	bus.Subscribe(EventPipelineStarted, func(ctx context.Context, event StandardEvent) error {
		count++
		return nil
	})
	bus.Subscribe(EventPipelineStarted, func(ctx context.Context, event StandardEvent) error {
		count++
		return nil
	})
	bus.Subscribe(EventPipelineStarted, func(ctx context.Context, event StandardEvent) error {
		count++
		return nil
	})
	if bus.SubscriberCount(EventPipelineStarted) != 3 {
		t.Fatalf("expected 3 subscribers, got %d", bus.SubscriberCount(EventPipelineStarted))
	}
}

func TestPublishSingleHandler(t *testing.T) {
	bus := NewEventBus()
	receivedEvent := StandardEvent{}
	bus.Subscribe(EventAlertResolved, func(ctx context.Context, event StandardEvent) error {
		receivedEvent = event
		return nil
	})
	event := StandardEvent{
		Type: EventAlertResolved,
	}
	err := bus.Publish(context.Background(), event)
	if err != nil {
		t.Fatalf("Publish() returned error: %v", err)
	}
	if receivedEvent.Type != EventAlertResolved {
		t.Fatalf("expected type %q, got %q", EventAlertResolved, receivedEvent.Type)
	}
}

func TestPublishMultipleHandlers(t *testing.T) {
	bus := NewEventBus()
	var results []string
	bus.Subscribe(EventIncidentCreated, func(ctx context.Context, event StandardEvent) error {
		results = append(results, "handler1")
		return nil
	})
	bus.Subscribe(EventIncidentCreated, func(ctx context.Context, event StandardEvent) error {
		results = append(results, "handler2")
		return nil
	})
	bus.Subscribe(EventIncidentCreated, func(ctx context.Context, event StandardEvent) error {
		results = append(results, "handler3")
		return nil
	})
	err := bus.Publish(context.Background(), StandardEvent{Type: EventIncidentCreated})
	if err != nil {
		t.Fatalf("Publish() returned error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d: %v", len(results), results)
	}
}

func TestPublishHandlerReturnsError(t *testing.T) {
	bus := NewEventBus()
	bus.Subscribe(EventChangeApproved, func(ctx context.Context, event StandardEvent) error {
		return errors.New("handler failure")
	})
	err := bus.Publish(context.Background(), StandardEvent{Type: EventChangeApproved})
	if err == nil {
		t.Fatal("expected error from handler, got nil")
	}
}

func TestPublishNoSubscribers(t *testing.T) {
	bus := NewEventBus()
	err := bus.Publish(context.Background(), StandardEvent{Type: EventChatOpsMessage})
	if err != nil {
		t.Fatalf("Publish() with no subscribers should return nil, got: %v", err)
	}
}

func TestPublishDifferentEventTypes(t *testing.T) {
	bus := NewEventBus()
	var received EventType
	bus.Subscribe(EventPipelineFailed, func(ctx context.Context, event StandardEvent) error {
		received = EventPipelineFailed
		return nil
	})
	bus.Subscribe(EventDeploymentFailed, func(ctx context.Context, event StandardEvent) error {
		received = EventDeploymentFailed
		return nil
	})
	err := bus.Publish(context.Background(), StandardEvent{Type: EventDeploymentFailed})
	if err != nil {
		t.Fatalf("Publish() returned error: %v", err)
	}
	if received != EventDeploymentFailed {
		t.Fatalf("expected only EventDeploymentFailed handler, got %q", received)
	}
}

func TestNewStandardEvent(t *testing.T) {
	payload := map[string]any{"severity": "critical"}
	event := NewStandardEvent(EventAlertTriggered, "alert-service", "tenant-1", payload)
	if event.Type != EventAlertTriggered {
		t.Fatalf("expected type %q, got %q", EventAlertTriggered, event.Type)
	}
	if event.Source != "alert-service" {
		t.Fatalf("expected source %q, got %q", "alert-service", event.Source)
	}
	if event.TenantID != "tenant-1" {
		t.Fatalf("expected tenantId %q, got %q", "tenant-1", event.TenantID)
	}
	if event.Version != "1.0.0" {
		t.Fatalf("expected version %q, got %q", "1.0.0", event.Version)
	}
	if event.Payload["severity"] != "critical" {
		t.Fatalf("expected payload severity %q, got %q", "critical", event.Payload["severity"])
	}
	if event.Metadata == nil {
		t.Fatal("expected non-nil metadata map")
	}
	if event.Timestamp.IsZero() {
		t.Fatal("expected non-zero timestamp")
	}
	if !event.Timestamp.After(time.Now().Add(-time.Second)) {
		t.Fatal("timestamp is in the past")
	}
}

func TestEventBusConcurrentAccess(t *testing.T) {
	bus := NewEventBus()
	var wg sync.WaitGroup
	ctx := context.Background()

	// Register handlers concurrently
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			bus.Subscribe(EventAlertTriggered, func(ctx context.Context, event StandardEvent) error {
				return nil
			})
		}()
	}
	wg.Wait()
	if bus.SubscriberCount(EventAlertTriggered) != 10 {
		t.Fatalf("expected 10 subscribers, got %d", bus.SubscriberCount(EventAlertTriggered))
	}

	// Publish concurrently
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = bus.Publish(ctx, StandardEvent{Type: EventAlertTriggered})
		}()
	}
	wg.Wait()
}

func TestEventTypeConstants(t *testing.T) {
	expected := map[EventType]string{
		EventAlertTriggered:    "alert.triggered",
		EventAlertResolved:     "alert.resolved",
		EventPipelineStarted:   "pipeline.started",
		EventPipelineCompleted: "pipeline.completed",
		EventPipelineFailed:    "pipeline.failed",
		EventIncidentCreated:   "incident.created",
		EventIncidentUpdated:   "incident.updated",
		EventChangeApproved:    "change.approved",
		EventChangeRejected:    "change.rejected",
		EventCIRDUpdated:       "cmdb.updated",
		EventApprovalSubmitted: "approval.submitted",
		EventApprovalApproved:  "approval.approved",
		EventDeploymentStarted: "deployment.started",
		EventDeploymentFailed:  "deployment.failed",
		EventChatOpsMessage:    "chatops.message",
	}
	if len(expected) < 15 {
		t.Fatalf("expected at least 15 event types, got %d", len(expected))
	}
	for k, v := range expected {
		if string(k) != v {
			t.Errorf("expected %q, got %q", v, string(k))
		}
	}
}
