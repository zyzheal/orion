package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps a go-redis client for gateway gray-release operations.
type Client struct {
	rdb     *redis.Client
	ctx     context.Context
	pubSub  *redis.PubSub
}

// NewClient creates a Redis client connected to the given addr.
func NewClient(ctx context.Context, addr string, password string, db int) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}
	return &Client{rdb: rdb, ctx: ctx}, nil
}

// Ping checks Redis connectivity.
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// Publish publishes a message to a Redis channel.
func (c *Client) Publish(ctx context.Context, channel string, msg string) error {
	return c.rdb.Publish(ctx, channel, msg).Err()
}

// Subscribe subscribes to a channel and returns a PubSub handle.
func (c *Client) Subscribe(ctx context.Context, channels ...string) (*redis.PubSub, error) {
	pubSub := c.rdb.Subscribe(ctx, channels...)
	return pubSub, pubSub.Subscribe(ctx, channels...)
}

// GetValue retrieves a string value from Redis.
func (c *Client) GetValue(ctx context.Context, key string) (string, error) {
	return c.rdb.Get(ctx, key).Result()
}

// SetValue sets a key with TTL.
func (c *Client) SetValue(ctx context.Context, key string, value string, ttl time.Duration) error {
	return c.rdb.Set(ctx, key, value, ttl).Err()
}

// Del deletes one or more keys.
func (c *Client) Del(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

// Close closes the underlying Redis connection.
func (c *Client) Close() error {
	if c.pubSub != nil {
		c.pubSub.Close()
	}
	return c.rdb.Close()
}
