//go:build !ignore

package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/code-svc-go/internal/models"

	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

// NATSSubscriber subscribes to CodeEvent via NATS JetStream.
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

// Start subscribes to CodeEvent subjects.
func (s *NATSSubscriber) Start(ctx context.Context) error {
	subject := fmt.Sprintf("%s.CodeEvent.>", s.stream)

	_, err := s.js.CreateOrUpdateConsumer(ctx, s.stream, jetstream.ConsumerConfig{
		Name:           "code-svc-consumer",
		FilterSubjects: []string{subject},
		AckPolicy:      jetstream.AckExplicitPolicy,
		MaxDeliver:     3,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}

	cons, err := s.js.Consumer(ctx, s.stream, "code-svc-consumer")
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
	var event models.EventBusEvent
	if err := json.Unmarshal(msg.Data(), &event); err != nil {
		s.log.Error("unmarshal event", zap.Error(err))
		msg.Term()
		return
	}

	s.log.Info("received CodeEvent",
		zap.String("event_type", event.EventType),
		zap.String("source", event.Source),
	)

	if err := s.handleCodeEvent(ctx, &event); err != nil {
		s.log.Error("handle code event", zap.Error(err))
		msg.NakWithDelay(time.Second)
		return
	}

	msg.Ack()
}

func (s *NATSSubscriber) handleCodeEvent(ctx context.Context, event *models.EventBusEvent) error {
	// TODO: 根据 event.EventType 触发相应的 Code 操作
	// 例如：CodeCommitted → 触发代码分析
	//       BranchCreated → 同步代码仓库状态
	return nil
}

// Close gracefully closes the NATS connection.
func (s *NATSSubscriber) Close() error {
	if s.conn != nil && !s.conn.IsClosed() {
		return s.conn.Drain()
	}
	return nil
}
