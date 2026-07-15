package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ephemeral-env/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- EphemeralEnv ---

func (r *Repository) CreateEnv(ctx context.Context, env *models.EphemeralEnv) error {
	env.ID = uuid.New().String()
	env.CreatedAt = time.Now().UTC()
	env.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ephemeral_env (id, tenant_id, environment_name, ttl_seconds, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :environment_name, :ttl_seconds, :status, :created_at, :updated_at)`, env)
	return err
}

func (r *Repository) GetEnv(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	var env models.EphemeralEnv
	err := r.db.GetContext(ctx, &env,
		`SELECT * FROM ephemeral_env WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *Repository) ListEnvs(ctx context.Context, tenantID string, limit, offset int) ([]models.EphemeralEnv, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.EphemeralEnv
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM ephemeral_env WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) CountEnvs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ephemeral_env WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdateEnv(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE ephemeral_env SET ttl_seconds=:ttl_seconds, status=:status, updated_at=:updated_at
		WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{"id": id, "tenant_id": tenantID, "ttl_seconds": updates["ttl_seconds"], "status": updates["status"], "updated_at": updates["updated_at"]})
	return err
}

func (r *Repository) DeleteEnv(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ephemeral_env WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- EnvLog ---

func (r *Repository) CreateEnvLog(ctx context.Context, log *models.EnvLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ephemeral_env_logs (id, env_id, level, message, created_at)
		VALUES (:id, :env_id, :level, :message, :created_at)`, log)
	return err
}

func (r *Repository) GetEnvLogs(ctx context.Context, tenantID, envID string, limit int) ([]models.EnvLog, error) {
	if limit <= 0 {
		limit = 100
	}
	var items []models.EnvLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT l.* FROM ephemeral_env_logs l
		JOIN ephemeral_env e ON l.env_id = e.id
		WHERE l.env_id=$1 AND e.tenant_id=$2 ORDER BY l.created_at DESC LIMIT $3`, envID, tenantID, limit)
	return items, err
}
