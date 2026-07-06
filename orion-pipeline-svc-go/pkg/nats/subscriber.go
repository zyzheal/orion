//go:build !ignore

package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"

	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

// NATSSubscriber subscribes to PipelineEvent via NATS JetStream.
type NATSSubscriber struct {
	conn        *nats.Conn
	js          jetstream.JetStream
	stream      string
	log         *zap.Logger
	pipelineSvc *service.PipelineService
}

// NewNATSSubscriber creates a new NATS subscriber.
func NewNATSSubscriber(addr, stream string, log *zap.Logger, pipelineSvc *service.PipelineService) (*NATSSubscriber, error) {
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
		conn:        conn,
		js:          js,
		stream:      stream,
		log:         log,
		pipelineSvc: pipelineSvc,
	}, nil
}

// Start subscribes to PipelineEvent subjects.
func (s *NATSSubscriber) Start(ctx context.Context) error {
	subject := fmt.Sprintf("%s.PipelineEvent.>", s.stream)

	_, err := s.js.CreateOrUpdateConsumer(ctx, s.stream, jetstream.ConsumerConfig{
		Name:           "pipeline-svc-consumer",
		FilterSubjects: []string{subject},
		AckPolicy:      jetstream.AckExplicitPolicy,
		MaxDeliver:     3,
		InactiveThreshold: 30 * time.Minute,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}

	cons, err := s.js.Consumer(ctx, s.stream, "pipeline-svc-consumer")
	if err != nil {
		return fmt.Errorf("get consumer: %w", err)
	}

	go s.consumeMessages(ctx, cons)
	s.log.Info("NATS subscriber started", zap.String("subject", subject))
	return nil
}

func (s *NATSSubscriber) consumeMessages(ctx context.Context, cons jetstream.Consumer) {
	cc, err := cons.Consume(func(msg jetstream.Msg) {
		s.handleMessage(ctx, msg)
	})
	if err != nil {
		s.log.Error("start consume", zap.Error(err))
		return
	}
	defer cc.Stop()
	<-ctx.Done()
}

func (s *NATSSubscriber) handleMessage(ctx context.Context, msg jetstream.Msg) {
	var event models.EventBusEvent
	if err := json.Unmarshal(msg.Data(), &event); err != nil {
		s.log.Error("unmarshal event", zap.Error(err))
		msg.Term()
		return
	}

	s.log.Info("received PipelineEvent",
		zap.String("event_type", event.EventType),
		zap.String("pipeline_id", event.PipelineID),
	)

	if err := s.handlePipelineEvent(ctx, &event); err != nil {
		s.log.Error("handle pipeline event", zap.Error(err))
		msg.NakWithDelay(time.Second)
		return
	}

	msg.Ack()
}

func (s *NATSSubscriber) handlePipelineEvent(ctx context.Context, event *models.EventBusEvent) error {
	// TODO: 根据 event.EventType 触发相应的 Pipeline 操作
	// 例如：PipelineCreated → 自动触发首次运行
	//       PipelineUpdated → 重新验证配置
	//       PipelineDeleted → 清理相关运行记录
	return nil
}

// Close gracefully closes the NATS connection.
func (s *NATSSubscriber) Close() error {
	if s.conn != nil && !s.conn.IsClosed() {
		return s.conn.Drain()
	}
	return nil
}
