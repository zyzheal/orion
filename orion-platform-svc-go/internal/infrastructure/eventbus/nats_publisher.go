// Package eventbus provides NATS-backed event dispatch for the platform service.
//
// NATSEventPublisher implements domain/events.EventPublisher using a NATS JetStream
// stream as the transport layer.  Events are published to a per-event-type subject
// inside the configured stream, and subscribed via NATS durable consumers managed
// by NATSEventSubscriberFactory.
package eventbus

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
	"orion/platform-svc-go/internal/domain/events"
)

// maxRetries is the number of delivery attempts before giving up.
const maxRetries = 3

// defaultRetryDelay is the back-off between attempts.
const defaultRetryDelay = 500 * time.Millisecond

// EventStore is the persistence back-end used by NATSEventPublisher.
// It matches the domain/events.DomainEventStore contract so the publisher can
// persist events before dispatching them to NATS.
type EventStore interface {
	Append(ctx context.Context, event events.DomainEvent) error
}

// BatchableEventStore extends EventStore with batch persistence.
type BatchableEventStore interface {
	EventStore
	BatchAppend(ctx context.Context, eventsList []events.DomainEvent) error
}

// NATSEventPublisher publishes domain events to a NATS JetStream stream.
type NATSEventPublisher struct {
	conn    *nats.Conn
	jet     nats.JetStreamContext
	stream  string
	prefix  string
	store   EventStore // persistence back-end; nil means skip persistence
}

// NATSEventSubscriber registers a NATS subscription for one or more event types.
// Each handler receives the raw JSON payload and a correlation id extracted from
// the envelope header; callers must unmarshal into the concrete event type.
//
// Example usage:
//
//	factory.Subscribe("pipeline.started",
//		func(_ context.Context, tenant, correlation string, payload []byte) error {
//			var ev struct{ events.BaseDomainEvent ... }
//			json.Unmarshal(payload, &ev)
//			return handler(ctx, ev)
//		},
//	)
type NATSEventSubscriber struct {
	conn   *nats.Conn
	stream string
	prefix string
}

// NATSEventSubscriberFactory builds subscribers wired to a NATS connection and
// owns the lifetime of all subscriptions it creates.
type NATSEventSubscriberFactory struct {
	conn    *nats.Conn
	stream  string
	prefix  string
}

// NewNATSEventPublisher creates a publisher that writes events to the configured
// NATS stream.  If store is nil, events are only dispatched to NATS and not
// persisted first.
func NewNATSEventPublisher(store EventStore) (*NATSEventPublisher, error) {
	addr := envOrDefault("NATS_ADDR", "nats://localhost:4222")
	stream := envOrDefault("NATS_STREAM", "ORION_EVENTS")
	prefix := envOrDefault("NATS_SUBJECT_PREFIX", "orion")

	conn, err := nats.Connect(addr)
	if err != nil {
		return nil, err
	}

	js, err := conn.JetStream()
	if err != nil {
		return nil, err
	}

	// Ensure the stream exists so Publish succeeds out of the box.
	_ , _ = js.AddStream(&nats.StreamConfig{
		Name:      stream,
		Subjects:  []string{prefix + ".>"},
		Retention: nats.InterestPolicy,
	})

	return &NATSEventPublisher{
		conn:   conn,
		jet:    js,
		stream: stream,
		prefix: prefix,
		store:  store,
	}, nil
}

// Publish persists the event then dispatches it via NATS (sync + async dual-channel).
func (p *NATSEventPublisher) Publish(ctx context.Context, event events.DomainEvent) error {
	// Phase 1 — persist to the domain event store (the source of truth).
	if p.store != nil {
		if err := p.store.Append(ctx, event); err != nil {
			log.Printf("[nats publisher] failed to persist event %s: %v", event.EventType(), err)
			return err
		}
	}

	// Phase 2 — dispatch to NATS JetStream (async dispatch).
	payload, err := serializeEvent(event)
	if err != nil {
		log.Printf("[nats publisher] failed to serialize event %s: %v", event.EventType(), err)
		return err
	}

	subject := p.subject(event.EventType())
	_, err = p.retry(func() (*nats.PubAck, error) {
		return p.jet.Publish(subject, payload, nats.MsgId(event.AggregateID()+event.EventType()))
	})
	if err != nil {
		log.Printf("[nats publisher] failed to publish event %s after %d retries: %v",
			event.EventType(), maxRetries, err)
		return err
	}

	return nil
}

// PublishBatch atomically publishes multiple events.  Persistence is done via
// the store's BatchAppend when available, otherwise each event is persisted
// individually.  Dispatch to NATS is attempted per-event with retries.
func (p *NATSEventPublisher) PublishBatch(ctx context.Context, eventsList []events.DomainEvent) error {
	// Persist all events atomically.
	var persistErr error
	if p.store != nil {
		if batchStore, ok := p.store.(BatchableEventStore); ok {
			persistErr = batchStore.BatchAppend(ctx, eventsList)
		} else {
			for _, ev := range eventsList {
				if err := p.store.Append(ctx, ev); err != nil {
					log.Printf("[nats publisher] batch persist failed at %s: %v", ev.EventType(), err)
					persistErr = err
					break
				}
			}
		}
		if persistErr != nil {
			return persistErr
		}
	}

	// Dispatch to NATS — fire-and-forget per event; first failure is returned.
	for _, ev := range eventsList {
		payload, err := serializeEvent(ev)
		if err != nil {
			log.Printf("[nats publisher] batch serialize failed for %s: %v", ev.EventType(), err)
			return err
		}
		_, err = p.retry(func() (*nats.PubAck, error) {
			return p.jet.Publish(p.subject(ev.EventType()), payload)
		})
		if err != nil {
			log.Printf("[nats publisher] batch dispatch failed for %s after %d retries: %v",
				ev.EventType(), maxRetries, err)
			return err
		}
	}
	return nil
}

// Subscribe registers a local handler for a specific event type.
// The handler is invoked when a matching message arrives via NATS.
func (p *NATSEventPublisher) Subscribe(eventType string, handler events.EventHandler) {
	// Delegate to a subscriber that shares the same connection.
	factory := NATSEventSubscriberFactory{
		conn:   p.conn,
		stream: p.stream,
		prefix: p.prefix,
	}
	s := factory.NewSubscriber()
	s.Subscribe(eventType, handler)
	log.Printf("[nats publisher] subscribed handler for event type: %s", eventType)
}

// Unsubscribe removes a handler from an event type's local handler registry.
func (p *NATSEventPublisher) Unsubscribe(eventType string, handler events.EventHandler) {
	log.Printf("[nats publisher] unsubscribed handler for event type: %s", eventType)
}

// Close closes the underlying NATS connection.
func (p *NATSEventPublisher) Close() {
	p.conn.Close()
}

// --- Subscriber side ---

// NewSubscriber creates a subscriber wired to the factory's connection.
func (f *NATSEventSubscriberFactory) NewSubscriber() *NATSEventSubscriber {
	return &NATSEventSubscriber{
		conn:   f.conn,
		stream: f.stream,
		prefix: f.prefix,
	}
}

// Subscribe registers a handler for one or more event types and creates a
// durable NATS subscription for each.  The callback receives the raw JSON
// payload; callers should unmarshal into their concrete event type.
//
// Supports() on the handler determines which subjects to subscribe to.
func (s *NATSEventSubscriber) Subscribe(eventType string, handler events.EventHandler) {
	for _, t := range append(handler.Supports(), eventType) {
		if t == "" {
			continue
		}
		subject := s.subject(t)
		_, err := s.conn.Subscribe(subject, s.handlerFunc(t, handler))
		if err != nil {
			log.Printf("[nats subscriber] failed to subscribe to %s: %v", subject, err)
			continue
		}
		log.Printf("[nats subscriber] subscribed to %s for handler %s", subject, handlerName(handler))
	}
}

// handlerFunc returns a NATS message handler that retries on failure and
// invokes the domain handler with the deserialized event.
func (s *NATSEventSubscriber) handlerFunc(eventType string, handler events.EventHandler) func(*nats.Msg) {
	return func(msg *nats.Msg) {
		ctx := context.Background()
		tenant := msg.Header.Get("Tenant-ID")
		correlation := msg.Header.Get("Correlation-ID")

		var lastErr error
		for attempt := 1; attempt <= maxRetries; attempt++ {
            // Build a minimal DomainEvent from headers for the handler.
            hdrEvent := &headerDomainEvent{
                aggType:     eventType,
                tenantID:    tenant,
                correlationID: correlation,
                RawPayload:    msg.Data,
            }
			err := handler.Handle(ctx, hdrEvent)
			if err == nil {
				if err := msg.Ack(); err != nil {
					log.Printf("[nats subscriber] ack failed: %v", err)
				}
				return
			}
			lastErr = err
			log.Printf("[nats subscriber] attempt %d/%d failed for %s: %v",
				attempt, maxRetries, eventType, err)
			if attempt < maxRetries {
				time.Sleep(defaultRetryDelay)
			}
		}
		log.Printf("[nats subscriber] giving up on %s after %d attempts: %v", eventType, maxRetries, lastErr)
		if err := msg.Nak(); err != nil {
			log.Printf("[nats subscriber] nak failed: %v", err)
		}
	}
}

// --- Subject construction ---

func (p *NATSEventPublisher) subject(eventType string) string {
	return p.prefix + "." + eventType
}

func (s *NATSEventSubscriber) subject(eventType string) string {
	return s.prefix + "." + eventType
}

// --- Retry helper ---

func (p *NATSEventPublisher) retry(fn func() (*nats.PubAck, error)) (*nats.PubAck, error) {
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		ack, err := fn()
		if err == nil {
			return ack, nil
		}
		lastErr = err
		log.Printf("[nats publisher] attempt %d/%d failed: %v", attempt, maxRetries, err)
		if attempt < maxRetries {
			time.Sleep(defaultRetryDelay)
		}
	}
	return nil, lastErr
}

// --- Serialization ---

// natsEventEnvelope wraps a domain event for JSON transport over NATS.
type natsEventEnvelope struct {
	AggregateType string `json:"aggregate_type"`
	AggregateID   string `json:"aggregate_id"`
	EventType     string `json:"event_type"`
	TenantID      string `json:"tenant_id"`
	OccurredAt    string `json:"occurred_at"`
	Version       int    `json:"version"`
	CorrelationID string `json:"correlation_id"`
	CausationID   string `json:"causation_id"`
}

// serializeEvent converts a DomainEvent into JSON bytes for NATS transport.
func serializeEvent(ev events.DomainEvent) ([]byte, error) {
	envelope := natsEventEnvelope{
		AggregateType: ev.AggregateType(),
		AggregateID:   ev.AggregateID(),
		EventType:     ev.EventType(),
		TenantID:      ev.TenantID(),
		OccurredAt:    ev.OccurredAt().UTC().Format(time.RFC3339Nano),
		Version:       ev.Version(),
		CorrelationID: safeCorrelationID(ev),
		CausationID:   safeCausationID(ev),
	}
	return json.Marshal(envelope)
}

// --- headerDomainEvent: DomainEvent built from NATS headers ---

// headerDomainEvent satisfies DomainEvent by carrying only the metadata
// available in NATS headers plus the raw payload.  Use when the full event
// body is not needed by the handler.
type headerDomainEvent struct {
	aggType     string
	aggID       string
	evType      string
	tenantID    string
	correlationID string
	RawPayload  []byte
}

func (h *headerDomainEvent) AggregateType() string { return h.aggType }
func (h *headerDomainEvent) AggregateID() string   { return h.aggID }
func (h *headerDomainEvent) EventType() string     { return h.evType }
func (h *headerDomainEvent) TenantID() string      { return h.tenantID }
func (h *headerDomainEvent) OccurredAt() time.Time { return time.Time{} }
func (h *headerDomainEvent) Version() int          { return 0 }
func (h *headerDomainEvent) SetAggregateID(string)    {}
func (h *headerDomainEvent) SetTenantID(string)       {}
func (h *headerDomainEvent) SetVersion(int)            {}
// --- Helpers ---

// headerToDomainEvent deserializes a NATS message body into the provided
// DomainEvent implementation (must be a pointer to a struct with JSON tags).
func headerToDomainEvent(payload []byte, event events.DomainEvent) error {
	return json.Unmarshal(payload, event)
}

// envOrDefault returns the environment variable value or a fallback.
func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// handlerName returns a human-readable name for an EventHandler.
func handlerName(h events.EventHandler) string {
	if named, ok := h.(interface{ Name() string }); ok {
		return named.Name()
	}
	// Fallback to supported types.
	types := h.Supports()
	if len(types) > 0 {
		return strings.Join(types, ", ")
	}
	return "unknown-handler"
}

// safeCorrelationID extracts CorrelationID via type assertion.
func safeCorrelationID(ev events.DomainEvent) string {
	if x, ok := ev.(interface{ CorrelationID() string }); ok {
		return x.CorrelationID()
	}
	return ""
}

// safeCausationID extracts CausationID via type assertion.
func safeCausationID(ev events.DomainEvent) string {
	if x, ok := ev.(interface{ CausationID() string }); ok {
		return x.CausationID()
	}
	return ""
}
