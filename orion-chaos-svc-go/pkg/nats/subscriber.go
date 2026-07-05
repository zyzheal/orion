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

// EventBusEvent represents an event published to NATS JetStream.
type EventBusEvent struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	EventType   string `json:"event_type"`
	Source      string `json:"source"`
	Payload     string `json:"payload,omitempty"`
	Priority    int    `json:"priority"`
	PipelineID  string `json:"pipeline_id,omitempty"`
	PublishedAt string `json:"published_at"`
	CreatedAt   string `json:"created_at"`
}

// NATSSubscriber subscribes to ChaosEvent via NATS JetStream.
type NATSSubscriber struct {
	conn        *nats.Conn
	js          jetstream.JetStream
	stream      string
	log         *zap.Logger
}

// NewNATSSubscriber creates a new NATS subscriber.
func NewNATSSubscriber(addr, stream string, log *zap.Logger) (*NATSSubscriber, error) {
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

	return &NATSSubscriber{
		conn:   conn,
		js:     js,
		stream: stream,
		log:    log,
	}, nil
}

// Start subscribes to ChaosEvent subjects.
func (s *NATSSubscriber) Start(ctx context.Context) error {
	subject := fmt.Sprintf("%s.ChaosEvent.>", s.stream)

	_, err := s.js.CreateOrUpdateConsumer(ctx, s.stream, jetstream.ConsumerConfig{
		Name:           "chaos-svc-consumer",
		FilterSubjects: []string{subject},
		AckPolicy:      jetstream.AckExplicitPolicy,
		MaxDeliver:     3,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}

	cons, err := s.js.Consumer(ctx, s.stream, "chaos-svc-consumer")
	if err != nil {
		return fmt.Errorf("get consumer: %w", err)
	}

	go s.consumeMessages(ctx, cons)
	s.log.Info("NATS subscriber started", zap.String("subject", subject))
	return nil
}

func (s *NATSSubscriber) consumeMessages(ctx context.Context, cons jetstream.Consumer) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			msgs, err := cons.Fetch(10, jetstream.FetchMaxWait(time.Second))
			if err != nil {
				s.log.Error("fetch messages", zap.Error(err))
				continue
			}
			for msg := range msgs.Messages() {
				s.handleMessage(ctx, msg)
			}
		}
	}
}

func (s *NATSSubscriber) handleMessage(ctx context.Context, msg jetstream.Msg) {
	var event EventBusEvent
	if err := json.Unmarshal(msg.Data(), &event); err != nil {
		s.log.Error("unmarshal event", zap.Error(err))
		msg.Term()
		return
	}

	s.log.Info("received ChaosEvent",
		zap.String("event_type", event.EventType),
		zap.String("source", event.Source),
	)

	if err := s.handleChaosEvent(ctx, &event); err != nil {
		s.log.Error("handle chaos event", zap.Error(err))
		msg.NakWithDelay(time.Second)
		return
	}

	msg.Ack()
}

func (s *NATSSubscriber) handleChaosEvent(ctx context.Context, event *EventBusEvent) error {
	// TODO: 根据 event.EventType 触发相应的 Chaos 操作
	// 例如：ChaosExperimentStarted → 记录实验状态
	//       ChaosExperimentCompleted → 更新实验结果
	return nil
}

// Close gracefully closes the NATS connection.
func (s *NATSSubscriber) Close() error {
	if s.conn != nil && !s.conn.IsClosed() {
		return s.conn.Drain()
	}
	return nil
}
