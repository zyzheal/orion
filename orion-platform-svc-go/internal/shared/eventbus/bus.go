package eventbus

import (
	"context"
	"sync"
)

// EventHandler is a function that processes a StandardEvent.
type EventHandler func(ctx context.Context, event StandardEvent) error

// EventBus is an in-process publish/subscribe event bus used for decoupling
// event producers from consumers across Orion modules.
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[EventType][]EventHandler
}

// NewEventBus creates a new EventBus instance.
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[EventType][]EventHandler),
	}
}

// Subscribe registers a handler for the given event type.
func (b *EventBus) Subscribe(eventType EventType, handler EventHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscribers[eventType] = append(b.subscribers[eventType], handler)
}

// Publish delivers the event to all registered handlers for its type.
func (b *EventBus) Publish(ctx context.Context, event StandardEvent) error {
	b.mu.RLock()
	handlers, ok := b.subscribers[event.Type]
	b.mu.RUnlock()
	if !ok {
		return nil
	}
	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			return err
		}
	}
	return nil
}

// SubscriberCount returns the number of registered handlers for a given event type.
func (b *EventBus) SubscriberCount(eventType EventType) int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscribers[eventType])
}
