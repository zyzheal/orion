// Package connector bridges domain CQRS aggregates with business modules.
// It transforms business events into CQRS commands and persists them to the event store.
package connector

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// EventType represents a business event category.
type EventType string

const (
	EventAlertTriggered   EventType = "alert.triggered"
	EventPipelineComplete EventType = "pipeline.completed"
	EventIncidentCreated  EventType = "incident.created"
	EventChangeApproved   EventType = "change.approved"
)

// BusinessEvent carries structured data from business modules to the CQRS layer.
type BusinessEvent struct {
	ID        string            `json:"id"`
	Type      EventType         `json:"type"`
	TenantID  string            `json:"tenantId"`
	Timestamp time.Time         `json:"timestamp"`
	Payload   map[string]any    `json:"payload"`
}

// CommandBus dispatches commands to the command handling pipeline.
type CommandBus interface {
	Dispatch(ctx context.Context, cmd any) error
}

// EventStore persists domain events for replay and read-model projection.
type EventStore interface {
	Append(ctx context.Context, events ...any) error
	GetStream(ctx context.Context, streamID string) ([]any, error)
}

// BusinessConnector is the bridge between business modules and the CQRS domain layer.
type BusinessConnector struct {
	mu         sync.RWMutex
	commandBus CommandBus
	eventStore EventStore
}

// NewBusinessConnector creates a connector wired to the given command bus and event store.
func NewBusinessConnector(cb CommandBus, es EventStore) *BusinessConnector {
	return &BusinessConnector{commandBus: cb, eventStore: es}
}

// ProcessAlertEvent dispatches an alert-related business event as a CQRS command.
func (bc *BusinessConnector) ProcessAlertEvent(ctx context.Context, event BusinessEvent) error {
	bc.mu.RLock()
	defer bc.mu.RUnlock()

	if bc.commandBus != nil {
		cmd := fmt.Sprintf("alert.%s: %s", event.Type, event.ID)
		return bc.commandBus.Dispatch(ctx, cmd)
	}
	return nil
}

// ProcessPipelineEvent stores a pipeline-related business event in the event store.
func (bc *BusinessConnector) ProcessPipelineEvent(ctx context.Context, event BusinessEvent) error {
	return bc.storeEvent(ctx, event)
}

// ProcessIncidentEvent stores an incident-related business event in the event store.
func (bc *BusinessConnector) ProcessIncidentEvent(ctx context.Context, event BusinessEvent) error {
	return bc.storeEvent(ctx, event)
}

// storeEvent appends the given business event to the configured event store.
func (bc *BusinessConnector) storeEvent(ctx context.Context, event BusinessEvent) error {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	if bc.eventStore != nil {
		return bc.eventStore.Append(ctx, event)
	}
	return nil
}
