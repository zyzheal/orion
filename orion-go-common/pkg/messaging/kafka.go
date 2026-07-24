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

	"github.com/IBM/sarama"
	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

// MessageHandler is a function that processes incoming message data.
// Used by both NATS and Kafka clients.
type MessageHandler func(data []byte) error

// Subscription represents an active subscription that can be cancelled.
type Subscription struct {
	subject string
	cancel  func()
}

// Unsubscribe cancels the subscription.
func (s *Subscription) Unsubscribe() {
	if s.cancel != nil {
		s.cancel()
	}
}

// ---------------------------------------------------------------------------
// Kafka client
// ---------------------------------------------------------------------------

// KafkaConfig holds configuration for the Kafka client.
type KafkaConfig struct {
	// Brokers is a list of Kafka broker addresses (e.g., ["localhost:9092"]).
	Brokers []string
	// ClientID is the Sarama client ID.
	ClientID string
	// SASLEnabled enables SASL authentication.
	SASLEnabled bool
	// SASLUser is the SASL username.
	SASLUser string
	// SASLPassword is the SASL password.
	SASLPassword string
	// SASLMechanism is the SASL mechanism ("PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512").
	SASLMechanism string
}

// KafkaClient wraps a Sarama producer and consumer for event publishing and consuming.
type KafkaClient struct {
	producer sarama.SyncProducer
	consumer sarama.Consumer
	config   *KafkaConfig
	logger   *zap.Logger
	mu       sync.RWMutex
}

// NewKafkaClient creates a new KafkaClient and initializes the Sarama producer and consumer.
func NewKafkaClient(cfg *KafkaConfig, logger *zap.Logger) (*KafkaClient, error) {
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	config.Producer.Return.Errors = true
	config.Consumer.Return.Errors = false

	if cfg.SASLEnabled {
		config.Net.SASL.Enable = true
		config.Net.SASL.User = cfg.SASLUser
		config.Net.SASL.Password = cfg.SASLPassword
		config.Net.SASL.Mechanism = sarama.SASLMechanism(cfg.SASLMechanism)
	}

	producer, err := sarama.NewSyncProducer(cfg.Brokers, config)
	if err != nil {
		return nil, fmt.Errorf("kafka producer init: %w", err)
	}

	consumer, err := sarama.NewConsumer(cfg.Brokers, config)
	if err != nil {
		producer.Close()
		return nil, fmt.Errorf("kafka consumer init: %w", err)
	}

	logger.Info("connected to Kafka", zap.Strings("brokers", cfg.Brokers))

	return &KafkaClient{
		producer: producer,
		consumer: consumer,
		config:   cfg,
		logger:   logger,
	}, nil
}

// Produce sends a message to a Kafka topic.
func (c *KafkaClient) Produce(topic string, key, value []byte) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	msg := &sarama.ProducerMessage{
		Topic: topic,
		Key:   sarama.ByteEncoder(key),
		Value: sarama.ByteEncoder(value),
	}

	partition, offset, err := c.producer.SendMessage(msg)
	if err != nil {
		return fmt.Errorf("kafka produce to %s: %w", topic, err)
	}

	c.logger.Debug("produced message",
		zap.String("topic", topic),
		zap.Int32("partition", partition),
		zap.Int64("offset", offset),
	)
	return nil
}

// Consume returns a channel of consumer messages for the given topic/partition/offset.
// The caller is responsible for closing the returned channel when done.
func (c *KafkaClient) Consume(topic string, partition int32, offset int64) (<-chan *sarama.ConsumerMessage, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	pc, err := c.consumer.ConsumePartition(topic, partition, offset)
	if err != nil {
		return nil, fmt.Errorf("kafka consume %s/%d: %w", topic, partition, err)
	}

	c.logger.Info("started consuming",
		zap.String("topic", topic),
		zap.Int32("partition", partition),
		zap.Int64("offset", offset),
	)
	return pc.Messages(), nil
}

// NewConsumerGroup creates a high-level consumer group for multiple topics.
// groupID is the consumer group ID for the group session.
func (c *KafkaClient) NewConsumerGroup(groupID string, topics []string) (sarama.ConsumerGroup, error) {
	cfg := sarama.NewConfig()
	if c.config.SASLEnabled {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.User = c.config.SASLUser
		cfg.Net.SASL.Password = c.config.SASLPassword
		cfg.Net.SASL.Mechanism = sarama.SASLMechanism(c.config.SASLMechanism)
	}
	cfg.Consumer.Group.Rebalance.Strategy = sarama.BalanceStrategyRoundRobin
	cfg.Consumer.Group.Session.Timeout = 10 * time.Second

	cg, err := sarama.NewConsumerGroup(c.config.Brokers, groupID, cfg)
	if err != nil {
		return nil, fmt.Errorf("kafka consumer group: %w", err)
	}
	return cg, nil
}

// Close shuts down the Kafka client (producer and consumer).
func (c *KafkaClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var errs []error
	if c.producer != nil {
		if err := c.producer.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close producer: %w", err))
		}
	}
	if c.consumer != nil {
		if err := c.consumer.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close consumer: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("kafka close errors: %v", errs)
	}
	return nil
}

// ---------------------------------------------------------------------------
// NATSSubscriber (defined in nats.go but declared here for cross-file reference)
// ---------------------------------------------------------------------------
