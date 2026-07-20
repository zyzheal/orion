// Package integration provides shared infrastructure for integration tests
// against a real PostgreSQL instance.
//
// Each test:
//   - Creates a transaction at start
//   - Rolls back at end (t.Cleanup), so no data leaks between tests
//   - If ORION_TEST_DSN is empty or DB is unreachable, test is skipped
package integration

import (
	"context"
	"database/sql"
	"fmt"
)

// DBProvider connects to the test database and provides transaction helpers.
type DBProvider struct {
	db  *sql.DB
	cfg *Config
}

// NewDBProvider opens a connection to the test database.
// Returns an error if DSN is empty; the caller should decide whether to
// skip or fail the test.
func NewDBProvider(cfg *Config) (*DBProvider, error) {
	if cfg == nil {
		cfg = NewConfig()
	}
	if cfg.DSN == "" {
		return nil, fmt.Errorf("ORION_TEST_DSN or DATABASE_URL not set")
	}

	db, err := sql.Open("postgres", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	if cfg.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}
	if cfg.ConnMaxIdleTime > 0 {
		db.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DBProvider{db: db, cfg: cfg}, nil
}

// Close releases the database connection.
func (p *DBProvider) Close() {
	if p.db != nil {
		p.db.Close()
	}
}

// DB returns the underlying *sql.DB for direct use.
func (p *DBProvider) DB() *sql.DB {
	return p.db
}

// BeginTx starts a new transaction. The caller is responsible for
// committing or rolling back. For test isolation, prefer BeginTxWithRollback
// which registers automatic rollback on t.Cleanup.
func (p *DBProvider) BeginTx(ctx context.Context, opts ...*sql.TxOptions) (*sql.Tx, error) {
	if len(opts) == 0 {
		return p.db.BeginTx(ctx, nil)
	}
	return p.db.BeginTx(ctx, opts[0])
}

// MustConnect opens the DB or panics. Use only in TestMain or setup code.
func MustConnect(cfg *Config) *DBProvider {
	provider, err := NewDBProvider(cfg)
	if err != nil {
		panic(err)
	}
	return provider
}
