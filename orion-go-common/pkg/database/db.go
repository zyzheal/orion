// Package database provides shared PostgreSQL connection management for Orion Go services.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DB wraps sqlx.DB with common utilities.
type DB struct {
	*sqlx.DB
}

// Config holds database connection configuration.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// DefaultConfig returns sensible defaults.
func DefaultConfig(dsn string) Config {
	return Config{
		DSN:             dsn,
		MaxOpenConns:    25,
		MaxIdleConns:    5,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 3 * time.Minute,
	}
}

// Connect opens a database connection with retry logic.
func Connect(ctx context.Context, cfg Config) (*DB, error) {
	db, err := sqlx.ConnectContext(ctx, "postgres", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	db.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)

	// Verify connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{DB: db}, nil
}

// ConnectWithRetry attempts to connect with exponential backoff.
func ConnectWithRetry(ctx context.Context, cfg Config, maxRetries int) (*DB, error) {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		db, err := Connect(ctx, cfg)
		if err == nil {
			return db, nil
		}
		lastErr = err

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(1<<uint(i)) * time.Second):
			// exponential backoff: 1s, 2s, 4s, ...
		}
	}
	return nil, fmt.Errorf("failed to connect after %d retries: %w", maxRetries, lastErr)
}

// Health checks database connectivity.
func (db *DB) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return db.PingContext(ctx)
}

// Stats returns database connection pool statistics.
func (db *DB) Stats() sql.DBStats {
	return db.DB.Stats()
}
