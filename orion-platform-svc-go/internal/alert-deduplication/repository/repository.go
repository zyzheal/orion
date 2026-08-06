package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/alert-deduplication/models"
)

// RepositoryInterface defines persistence operations for alert deduplication.
type RepositoryInterface interface {
	Insert(ctx context.Context, r *models.DeduplicationRecord) error
	GetByFingerprint(ctx context.Context, tenantID uuid.UUID, fingerprint string) (*models.DeduplicationRecord, error)
	CountActive(ctx context.Context, tenantID uuid.UUID, since time.Time) (int, error)
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Insert stores a deduplication record.
func (r *Repository) Insert(ctx context.Context, rec *models.DeduplicationRecord) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO alert_deduplication_records
		(id, tenant_id, original_id, duplicate_id, fingerprint, deduped_at)
		VALUES (:id, :tenant_id, :original_id, :duplicate_id, :fingerprint, :deduped_at)
	`, rec)
	return err
}

// GetByFingerprint finds the most recent record matching a fingerprint for a tenant.
func (r *Repository) GetByFingerprint(ctx context.Context, tenantID uuid.UUID, fingerprint string) (*models.DeduplicationRecord, error) {
	var rec models.DeduplicationRecord
	err := r.db.GetContext(ctx, &rec, `
		SELECT id, tenant_id, original_id, duplicate_id, fingerprint, deduped_at
		FROM alert_deduplication_records
		WHERE tenant_id = $1 AND fingerprint = $2
		ORDER BY deduped_at DESC
		LIMIT 1
	`, tenantID, fingerprint)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &rec, nil
}

// CountActive counts deduplication records created since the given time.
func (r *Repository) CountActive(ctx context.Context, tenantID uuid.UUID, since time.Time) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM alert_deduplication_records
		WHERE tenant_id = $1 AND deduped_at >= $2
	`, tenantID, since)
	return count, err
}
