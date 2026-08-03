//go:build !ignore

package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

// EventBusEvent wraps an event from the event bus.
type EventBusEvent struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
	Source  string          `json:"source"`
}

// SelfHealingEvent describes a published self-healing action event.
type SelfHealingEvent struct {
	Type          string                 `json:"type"`
	Source        string                 `json:"source"`
	HealingAction string                 `json:"healingAction"`
	Target        string                 `json:"target"`
	Status        string                 `json:"status"`
	Timestamp     int64                  `json:"timestamp"`
	TenantID      string                 `json:"tenantId"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// EventHandler defines the callback for handling self-healing events.
type EventHandler interface {
	HandleSelfHealingEvent(ctx context.Context, event *SelfHealingEvent) error
}

// NATSSubscriber subscribes to SelfHealingEvent via NATS JetStream.
type NATSSubscriber struct {
	conn    *nats.Conn
	js      jetstream.JetStream
	stream  string
	log     *zap.Logger
	handler EventHandler
}

func NewNATSSubscriber(addr, stream string, log *zap.Logger, handler EventHandler) (*NATSSubscriber, error) {
	opts := []nats.Option{nats.MaxReconnects(10), nats.ReconnectWait(2 * time.Second)}
	conn, err := nats.Connect(addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("connect to NATS at %s: %w", addr, err)
	}
	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("init JetStream: %w", err)
	}
	return &NATSSubscriber{conn: conn, js: js, stream: stream, log: log, handler: handler}, nil
}

func (s *NATSSubscriber) Start(ctx context.Context) error {
	subject := fmt.Sprintf("%s.SelfHealingEvent.>", s.stream)
	consName := "selfhealing-svc-consumer"

	_, err := s.js.CreateOrUpdateConsumer(ctx, s.stream, jetstream.ConsumerConfig{
		Name:              consName,
		FilterSubjects:    []string{subject},
		AckPolicy:         jetstream.AckExplicitPolicy,
		MaxDeliver:        3,
		InactiveThreshold: 30 * time.Minute,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}

	cons, err := s.js.Consumer(ctx, s.stream, consName)
	if err != nil {
		return fmt.Errorf("get consumer: %w", err)
	}

	go s.consumeMessages(ctx, cons)
	s.log.Info("self-healing NATS subscriber started", zap.String("subject", subject))
	return nil
}

func (s *NATSSubscriber) consumeMessages(ctx context.Context, cons jetstream.Consumer) {
	_, err := cons.Consume(func(msg jetstream.Msg) {
		s.handleSelfHealingEvent(ctx, msg)
	})
	if err != nil {
		s.log.Error("start consume", zap.Error(err))
		return
	}
	s.log.Info("self-healing consumer running")
}

func (s *NATSSubscriber) handleSelfHealingEvent(ctx context.Context, msg jetstream.Msg) {
	var event EventBusEvent
	if err := json.Unmarshal(msg.Data(), &event); err != nil {
		msg.Ack()
		s.log.Error("failed to unmarshal self-healing event", zap.Error(err))
		return
	}

	healingEvent := &SelfHealingEvent{}
	if err := json.Unmarshal(event.Payload, healingEvent); err != nil {
		msg.Ack()
		s.log.Error("failed to unmarshal payload", zap.Error(err))
		return
	}

	if s.handler != nil {
		if err := s.handler.HandleSelfHealingEvent(ctx, healingEvent); err != nil {
			s.log.Error("failed to handle self-healing event", zap.Error(err))
			msg.Nak()
			return
		}
	}

	msg.Ack()
	s.log.Debug("self-healing event processed", zap.String("type", event.Type), zap.String("id", event.ID))
}
