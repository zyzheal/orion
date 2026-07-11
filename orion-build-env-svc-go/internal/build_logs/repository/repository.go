package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-build-env-svc-go/internal/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateLog creates a new build log
func (r *Repository) CreateLog(ctx context.Context, tenantID string, log *models.BuildLog) error {
	log.ID = uuid.New().String()
	log.TenantID = tenantID
	log.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO build_log (id, tenant_id, build_id, level, message, created_at)
		 VALUES (:id, :tenant_id, :build_id, :level, :message, :created_at)`,
		log)
	if err != nil {
		return fmt.Errorf("failed to create build log: %w", err)
	}
	return nil
}

// ListLogs lists build logs for a tenant
func (r *Repository) ListLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.BuildLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, build_id, level, message, created_at
		 FROM build_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetLog gets a build log by ID
func (r *Repository) GetLog(ctx context.Context, tenantID, id string) (*models.BuildLog, error) {
	var log models.BuildLog
	err := r.db.GetContext(ctx, &log,
		`SELECT id, tenant_id, build_id, level, message, created_at
		 FROM build_log WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &log, nil
}
