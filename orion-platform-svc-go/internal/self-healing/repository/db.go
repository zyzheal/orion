package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// DB wraps pgxpool and provides common query helpers.
type DB struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewDB(pool *pgxpool.Pool, log *zap.Logger) *DB {
	return &DB{pool: pool, logger: log}
}

func (d *DB) Pool() *pgxpool.Pool {
	return d.pool
}

func (d *DB) Logger() *zap.Logger {
	return d.logger
}

// RunMigrations is a no-op stub — migrations are run by the platform service.
func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	d.logger.Info("migrations stub", zap.String("dir", migrationsDir))
	return nil
}

// ExecContext executes a query and returns the result (sqlx-compatible wrapper).
func (d *DB) ExecContext(ctx context.Context, query string, args ...interface{}) (interface{}, error) {
	tag, err := d.pool.Exec(ctx, query, args...)
	return tag, err
}

// GetContext executes a query that returns a single row and scans the result into dest.
func (d *DB) GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return d.pool.QueryRow(ctx, query, args...).Scan(dest)
}
