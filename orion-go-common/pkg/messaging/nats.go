// Package messaging provides shared message queue clients for Orion Go services.
//
// Supports NATS (lightweight pub/sub, JetStream) and Kafka (Apache Kafka via Sarama).
// Provides a common MessageHandler interface so event consumers work with either backend.
package messaging

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// NATS client
// ---------------------------------------------------------------------------

// NATSConfig holds configuration for the NATS client.
type NATSConfig struct {
	// URLs is a comma-separated list of NATS server URLs (e.g., "nats://localhost:4222").
	URLs string
	// User is the NATS username (optional, for nkey/basic auth).
	User string
	// Password is the NATS password (optional).
	Password string
	// NKey is the NATS nkey seed (optional, for nkey auth).
	NKey string
	// JetStream is the JetStream domain name (optional).
	JetStream string
}

// NATSClient wraps a NATS connection for event publishing and subscribing.
type NATSClient struct {
	conn   *nats.Conn
	js     nats.JetStream
	config *NATSConfig
	logger *zap.Logger
	mu     sync.RWMutex
	status string // "connected" | "disconnected" | "fallback"
}

// NewNATSClient creates a new NATSClient with the given configuration.
func NewNATSClient(cfg *NATSConfig, logger *zap.Logger) *NATSClient {
	return &NATSClient{
		config: cfg,
		logger: logger,
		status: "disconnected",
	}
}

// Connect establishes the NATS connection.
func (c *NATSClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.status == "connected" {
		return nil
	}

	opts := []nats.Option{
		nats.MaxReconnects(-1),        // infinite reconnect
		nats.ReconnectWait(2 * time.Second),
		nats.Timeout(5 * time.Second),
	}

	if c.config.User != "" {
		opts = append(opts, nats.UserInfo(c.config.User, c.config.Password))
	}
	if c.config.NKey != "" {
		nkey, err := nats.NkeyOptionFromSeed(c.config.NKey)
		if err != nil {
			return fmt.Errorf("nats nkey parse: %w", err)
		}
		opts = append(opts, nkey)
	}

	conn, err := nats.Connect(c.config.URLs, opts...)
	if err != nil {
		c.logger.Warn("NATS not available, running in fallback mode", zap.Error(err))
		c.status = "fallback"
		return fmt.Errorf("nats connect: %w", err)
	}

	c.conn = conn

	if c.config.JetStream != "" {
		js, err := conn.JetStream(nats.Domain(c.config.JetStream))
		if err != nil {
			c.logger.Warn("JetStream unavailable", zap.Error(err))
		} else {
			c.js = js
		}
	}

	c.status = "connected"
	c.logger.Info("connected to NATS", zap.String("urls", c.config.URLs))
	return nil
}

// IsConnected reports whether the NATS client is connected.
func (c *NATSClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.status == "connected"
}

// Status returns the current connection status string.
func (c *NATSClient) Status() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.status
}

// Publish publishes raw bytes to a NATS subject.
func (c *NATSClient) Publish(subject string, data []byte) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil || !c.conn.IsConnected() {
		return fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	if err := c.conn.Publish(subject, data); err != nil {
		return fmt.Errorf("nats publish to %s: %w", subject, err)
	}

	c.logger.Debug("published message", zap.String("subject", subject))
	return nil
}

// PublishWithHeaders publishes a message with headers to a NATS subject.
func (c *NATSClient) PublishWithHeaders(subject string, data []byte, headers map[string]string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil || !c.conn.IsConnected() {
		return fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	msg := &nats.Msg{Subject: subject, Data: data, Header: nats.Header{}}
	for k, v := range headers {
		msg.Header.Set(k, v)
	}

	if err := c.conn.PublishMsg(msg); err != nil {
		return fmt.Errorf("nats publish to %s: %w", subject, err)
	}

	c.logger.Debug("published message with headers", zap.String("subject", subject))
	return nil
}

// PublishJetStream publishes a message to a JetStream stream.
// stream is the target stream name, subject is the NATS subject within the stream.
func (c *NATSClient) PublishJetStream(ctx context.Context, stream, subject string, data []byte) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.js == nil {
		return fmt.Errorf("jetstream not configured")
	}
	if c.conn == nil || !c.conn.IsConnected() {
		return fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	_, err := c.js.Publish(subject, data, nats.Context(ctx))
	if err != nil {
		return fmt.Errorf("nats jetstream publish to %s/%s: %w", stream, subject, err)
	}

	c.logger.Debug("published jetstream message", zap.String("stream", stream), zap.String("subject", subject))
	return nil
}

// Subscribe creates a subscription on a NATS subject using the common MessageHandler interface.
// Returns a Subscription handle that can be used to unsubscribe.
func (c *NATSClient) Subscribe(subject string, handler MessageHandler) (*Subscription, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil || !c.conn.IsConnected() {
		return nil, fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	sub, err := c.conn.Subscribe(subject, func(m *nats.Msg) {
		_ = handler(m.Data)
	})
	if err != nil {
		return nil, fmt.Errorf("nats subscribe to %s: %w", subject, err)
	}

	s := &Subscription{
		subject: subject,
		cancel: func() {
			sub.Unsubscribe()
		},
	}

	c.logger.Info("subscribed to NATS", zap.String("subject", subject))
	return s, nil
}

// Close closes the NATS connection.
func (c *NATSClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil && c.conn.IsConnected() {
		c.conn.Close()
	}
	c.status = "disconnected"
	c.conn = nil
	c.js = nil
	return nil
}

// ---------------------------------------------------------------------------
// NATSSubscriber - JetStream-aware pull subscriber
// ---------------------------------------------------------------------------

// NATSSubscriber subscribes to a NATS subject and streams messages.
type NATSSubscriber struct {
	natsClient *NATSClient
	subject    string
	stream     string
	logger     *zap.Logger
}

// NewNATSSubscriber creates a new JetStream-aware subscriber.
func NewNATSSubscriber(natsClient *NATSClient, subject, stream string, logger *zap.Logger) *NATSSubscriber {
	return &NATSSubscriber{
		natsClient: natsClient,
		subject:    subject,
		stream:     stream,
		logger:     logger,
	}
}

// Start begins consuming from the subject.
func (s *NATSSubscriber) Start(ctx context.Context) error {
	_, err := s.natsClient.Subscribe(s.subject, func(data []byte) error {
		s.logger.Debug("received message", zap.String("subject", s.subject))
		return nil
	})
	return err
}

// Close stops the subscriber.
func (s *NATSSubscriber) Close() error {
	return nil
}
