package repository

import (
	"context"

	internalrepo "orion/platform-svc-go/internal/repository"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// DB wraps *sqlx.DB for the alert-correlation repository.
type DB struct {
	internalrepo.TenantAwareRepository[any]
	DB     *sqlx.DB
	logger *zap.Logger
}

func NewDB(db *sqlx.DB, log *zap.Logger) *DB {
	return &DB{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
		DB:                    db,
		logger:                log,
	}
}

func (d *DB) Logger() *zap.Logger {
	return d.logger
}

// RunMigrations is a no-op stub — migrations are run by the platform service.
func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	d.logger.Info("migrations stub", zap.String("dir", migrationsDir))
	return nil
}
