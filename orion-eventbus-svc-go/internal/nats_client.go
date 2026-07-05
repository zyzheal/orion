package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/eventbus-svc-go/internal/model"

	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

// NATSClient wraps NATS JetStream connection and provides event publishing.
type NATSClient struct {
	conn   *nats.Conn
	js     jetstream.JetStream
	stream string
	log    *zap.Logger
}

// NewNATSClient connects to NATS and ensures the event stream exists.
func NewNATSClient(addr, streamName string, log *zap.Logger) (*NATSClient, error) {
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

	// Ensure stream exists
	_, err = js.Stream(context.Background(), streamName)
	if err != nil {
		_, err = js.CreateStream(context.Background(), jetstream.StreamConfig{
			Name:     streamName,
			Subjects: []string{fmt.Sprintf("%s.>", streamName)},
		})
		if err != nil {
			conn.Close()
			return nil, fmt.Errorf("create stream %s: %w", streamName, err)
		}
		log.Info("NATS stream created", zap.String("stream", streamName))
	}

	log.Info("NATS JetStream connected", zap.String("addr", addr), zap.String("stream", streamName))
	return &NATSClient{conn: conn, js: js, stream: streamName, log: log}, nil
}

// Publish publishes an event to NATS JetStream.
// Subject pattern: <stream>.<eventType>.<tenantID>
func (c *NATSClient) Publish(ctx context.Context, e *model.Event) error {
	subject := fmt.Sprintf("%s.%s.%s", c.stream, e.Type, e.TenantID)
	payload, err := json.Marshal(e)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	_, err = c.js.Publish(ctx, subject, payload)
	if err != nil {
		return fmt.Errorf("publish to %s: %w", subject, err)
	}

	c.log.Debug("event published to NATS",
		zap.String("subject", subject),
		zap.String("event_id", e.ID),
		zap.String("tenant_id", e.TenantID),
	)
	return nil
}

// Close gracefully closes the NATS connection.
func (c *NATSClient) Close() {
	if c.conn != nil && !c.conn.IsClosed() {
		c.conn.Drain()
		c.conn.Close()
	}
}
