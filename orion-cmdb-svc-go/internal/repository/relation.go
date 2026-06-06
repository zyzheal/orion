package repository

import (
	"context"
	"orion-cmdb-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type CIRelationRepository struct {
	db *sqlx.DB
}

func NewCIRelationRepository(db *sqlx.DB) *CIRelationRepository {
	return &CIRelationRepository{db: db}
}

func (r *CIRelationRepository) Create(ctx context.Context, rel *models.CIRelation) error {
	query := `INSERT INTO ci_relations (id, tenant_id, source_ci_id, target_ci_id, relation_type)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query,
		rel.ID, rel.TenantID, rel.SourceCIID, rel.TargetCIID, rel.RelationType,
	)
	return err
}

func (r *CIRelationRepository) ListByCI(ctx context.Context, tenantID, ciID string) ([]models.CIRelation, error) {
	var rels []models.CIRelation
	err := r.db.SelectContext(ctx, &rels,
		"SELECT * FROM ci_relations WHERE tenant_id = $1 AND (source_ci_id = $2 OR target_ci_id = $2)",
		tenantID, ciID)
	return rels, err
}

func (r *CIRelationRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM ci_relations WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}

func (r *CIRelationRepository) DeleteByCI(ctx context.Context, tenantID, ciID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM ci_relations WHERE tenant_id = $1 AND (source_ci_id = $2 OR target_ci_id = $2)",
		tenantID, ciID)
	return err
}

func (r *CIRelationRepository) Exists(ctx context.Context, tenantID, sourceID, targetID, relType string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		"SELECT EXISTS(SELECT 1 FROM ci_relations WHERE tenant_id = $1 AND source_ci_id = $2 AND target_ci_id = $3 AND relation_type = $4)",
		tenantID, sourceID, targetID, relType)
	return exists, err
}
