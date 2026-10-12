package repository

import (
	"github.com/jmoiron/sqlx"
	// TenantAwareRepository-backed re-export of the internal visor repository.
	internalrepo "orion/platform-svc-go/internal/visor/internal/repository"
)

// Repository re-exports the internal visor repository implementation.
type Repository = internalrepo.Repository

// NewRepository creates a new Repository backed by the given *sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return internalrepo.NewRepository(db)
}
