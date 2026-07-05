package nats

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
)

// Client wraps NATS connection for event publishing and subscribing
type Client struct {
	conn   *nats.Conn
	config *Config
	logger *zap.Logger
	mu     sync.RWMutex
	status string // connected | disconnected | fallback
}

// Config holds NATS connection configuration
type Config struct {
	URLs      string
	User      string
	Password  string
}

// Message represents a NATS message with metadata
type Message struct {
	Subject  string
	Data     []byte
	Headers  map[string]string
	TenantID string
}

// MessageHandler is a callback for handling received messages
type MessageHandler func(ctx context.Context, msg *Message) error

// NewClient creates a new NATS client
func NewClient(cfg *Config, logger *zap.Logger) *Client {
	return &Client{
		config: cfg,
		logger: logger,
		status: "disconnected",
	}
}

// Connect establishes NATS connection
func (c *Client) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.status == "connected" {
		return nil
	}

	opts := []nats.Option{
		nats.Name("orion-event-bus-svc"),
		nats.MaxReconnects(-1), // infinite reconnect
		nats.ReconnectWait(2 * time.Second),
		nats.Timeout(5 * time.Second),
	}

	if c.config.User != "" {
		opts = append(opts, nats.UserInfo(c.config.User, c.config.Password))
	}

	conn, err := nats.Connect(c.config.URLs, opts...)
	if err != nil {
		c.logger.Warn("failed to connect to NATS, running in fallback mode", zap.Error(err))
		c.status = "fallback"
		return fmt.Errorf("nats connect: %w", err)
	}

	c.conn = conn
	c.status = "connected"

	c.logger.Info("connected to NATS", zap.String("urls", c.config.URLs))
	return nil
}

// IsConnected returns true if NATS is connected
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.status == "connected"
}

// Status returns the current connection status
func (c *Client) Status() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.status
}

// Publish publishes a message to a subject
func (c *Client) Publish(ctx context.Context, subject string, data []byte, headers map[string]string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil || !c.conn.IsConnected() {
		return fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	msg := &nats.Msg{
		Subject: subject,
		Data:    data,
		Header:  nats.Header{},
	}
	for k, v := range headers {
		msg.Header.Set(k, v)
	}

	if err := c.conn.PublishMsg(msg); err != nil {
		return fmt.Errorf("nats publish: %w", err)
	}

	c.logger.Debug("published message", zap.String("subject", subject))
	return nil
}

// Subscribe creates a subscription on a subject
func (c *Client) Subscribe(ctx context.Context, subject string, handler MessageHandler) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil || !c.conn.IsConnected() {
		return fmt.Errorf("nats not connected (status: %s)", c.status)
	}

	_, err := c.conn.Subscribe(subject, func(m *nats.Msg) {
		headers := make(map[string]string)
		for k, v := range m.Header {
			headers[k] = v[0]
		}
		message := &Message{
			Subject:  m.Subject,
			Data:     m.Data,
			Headers:  headers,
			TenantID: headers["tenant_id"],
		}
		if err := handler(ctx, message); err != nil {
			c.logger.Error("message handler error", zap.Error(err))
		}
	})
	if err != nil {
		return fmt.Errorf("nats subscribe: %w", err)
	}

	c.logger.Info("subscribed to NATS",
		zap.String("subject", subject),
		)
	return nil
}

// Close closes the NATS connection
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil && c.conn.IsConnected() {
		c.conn.Close()
	}
	c.status = "disconnected"
	c.conn = nil
	return nil
}
