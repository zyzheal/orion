package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/artifact-lifecycle/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, lc *models.ArtifactLifecycle) error {
	lc.ID = uuid.New().String()
	lc.CreatedAt = time.Now().UTC()
	lc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_lifecycle (id, tenant_id, artifact_id, stage, stage_status, created_at, updated_at)
		VALUES (:id, :tenant_id, :artifact_id, :stage, :stage_status, :created_at, :updated_at)`, lc)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	var lc models.ArtifactLifecycle
	err := r.db.GetContext(ctx, &lc,
		`SELECT * FROM artifact_lifecycle WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &lc, nil
}

func (r *Repository) GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error) {
	var lc models.ArtifactLifecycle
	err := r.db.GetContext(ctx, &lc,
		`SELECT * FROM artifact_lifecycle WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, artifactID, tenantID)
	if err != nil {
		return nil, err
	}
	return &lc, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.ArtifactLifecycle, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.ArtifactLifecycle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_lifecycle WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifact_lifecycle WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE artifact_lifecycle SET stage=:stage, stage_status=:stage_status, updated_at=:updated_at
		WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{"id": id, "tenant_id": tenantID, "stage": updates["stage"], "stage_status": updates["stage_status"], "updated_at": updates["updated_at"]})
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM artifact_lifecycle WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetStageHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactLifecycle, error) {
	var items []models.ArtifactLifecycle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_lifecycle WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at ASC`, id, tenantID)
	return items, err
}

func (r *Repository) Archive(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_lifecycle SET stage='archived', stage_status='archived', updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
