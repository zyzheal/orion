// Package redis provides shared Redis client management for Orion Go services.
//
// Replaces per-service duplicated Redis client creation.
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Config holds Redis connection configuration.
type Config struct {
	// Addr is the Redis address (host:port). Default: "localhost:6379".
	Addr string
	// Password is the Redis password. Default: "".
	Password string
	// DB is the Redis database number. Default: 0.
	DB int
	// PoolSize is the maximum number of connections. Default: 10 * runtime.GOMAXPROCS.
	PoolSize int
	// MinIdleConns is the minimum number of idle connections. Default: 0.
	MinIdleConns int
	// DialTimeout is the timeout for establishing new connections. Default: 5s.
	DialTimeout time.Duration
	// ReadTimeout is the timeout for socket reads. Default: 3s.
	ReadTimeout time.Duration
	// WriteTimeout is the timeout for socket writes. Default: 3s.
	WriteTimeout time.Duration
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() Config {
	return Config{
		Addr:         "localhost:6379",
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}
}

// NewClient creates a new Redis client from the given configuration.
func NewClient(cfg Config) *redis.Client {
	if cfg.Addr == "" {
		cfg.Addr = "localhost:6379"
	}
	if cfg.DialTimeout == 0 {
		cfg.DialTimeout = 5 * time.Second
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 3 * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = 3 * time.Second
	}

	opts := &redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	return redis.NewClient(opts)
}

// NewClientFromURL creates a Redis client from a Redis URL (e.g., "redis://localhost:6379/0").
func NewClientFromURL(url string) (*redis.Client, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}
	return redis.NewClient(opts), nil
}

// Health checks Redis connectivity.
func Health(ctx context.Context, client *redis.Client) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return client.Ping(ctx).Err()
}
