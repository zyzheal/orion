package repository

import (
	"context"

	"go.uber.org/zap"
	"github.com/jmoiron/sqlx"
)

// DB wraps *sqlx.DB for the alert-silence repository.
type DB struct {
	DB     *sqlx.DB
	logger *zap.Logger
}

func NewDB(db *sqlx.DB, log *zap.Logger) *DB {
	return &DB{DB: db, logger: log}
}

func (d *DB) Logger() *zap.Logger {
	return d.logger
}

// RunMigrations is a no-op stub — migrations are run by the platform service.
func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	d.logger.Info("migrations stub", zap.String("dir", migrationsDir))
	return nil
}
