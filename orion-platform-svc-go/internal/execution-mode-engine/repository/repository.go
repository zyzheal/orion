package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/execution-mode-engine/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ExecutionModeRepository interface {
	Create(ctx context.Context, config *models.ExecutionModeConfig) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error)
	List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error)
	Update(ctx context.Context, config *models.ExecutionModeConfig) error
	Delete(ctx context.Context, tenantID, id string) error
}

type executionModeRepo struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) ExecutionModeRepository {
	return &executionModeRepo{db: db}
}

func (r *executionModeRepo) Create(ctx context.Context, config *models.ExecutionModeConfig) error {
	if config.ID == "" {
		config.ID = uuid.New().String()
	}
	config.TenantID = config.TenantID
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO execution_modes (id, tenant_id, name, mode, timeout_ms, retries, worker_pool, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :mode, :timeout_ms, :retries, :worker_pool, :enabled, NOW(), NOW())`,
		config)
	return err
}

func (r *executionModeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error) {
	var config models.ExecutionModeConfig
	err := r.db.GetContext(ctx, &config, `SELECT * FROM execution_modes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &config, err
}

func (r *executionModeRepo) List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error) {
	var items []models.ExecutionModeConfig
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM execution_modes WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.ExecutionModeConfig{}
	}
	return items, nil
}

func (r *executionModeRepo) Update(ctx context.Context, config *models.ExecutionModeConfig) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE execution_modes SET
			name=:name, mode=:mode, timeout_ms=:timeout_ms, retries=:retries, worker_pool=:worker_pool, enabled=:enabled, updated_at=NOW()
		WHERE id=:id AND tenant_id=:tenant_id`,
		config)
	if err != nil {
		return err
	}
	return nil
}

func (r *executionModeRepo) Delete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM execution_modes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}