package repository

import (
	"context"
	"orion-cmdb-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// CIRelationRepository handles all database operations for the ci_relations table.
// All queries scope by tenant_id and exclude soft-deleted rows.
type CIRelationRepository struct {
	db *sqlx.DB
}

func NewCIRelationRepository(db *sqlx.DB) *CIRelationRepository {
	return &CIRelationRepository{db: db}
}

// Create inserts a new relation between two CIs.
func (r *CIRelationRepository) Create(ctx context.Context, rel *models.CIRelation) error {
	query := `INSERT INTO ci_relations
		(id, tenant_id, source_ci_id, target_ci_id, relation_type, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		rel.ID, rel.TenantID, rel.SourceCIID, rel.TargetCIID,
		rel.RelationType, rel.Description, rel.CreatedBy,
	)
	return err
}

// GetByID returns a single relation by its UUID, scoped to a tenant.
func (r *CIRelationRepository) GetByID(ctx context.Context, id, tenantID string) (*models.CIRelation, error) {
	var rel models.CIRelation
	err := r.db.GetContext(ctx, &rel,
		`SELECT * FROM ci_relations
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rel, nil
}

// ListByCI returns all active relations where the given CI is either source or target.
func (r *CIRelationRepository) ListByCI(ctx context.Context, tenantID, ciID string) ([]models.CIRelation, error) {
	var rels []models.CIRelation
	err := r.db.SelectContext(ctx, &rels,
		`SELECT * FROM ci_relations
		 WHERE tenant_id = $1 AND (source_ci_id = $2 OR target_ci_id = $2)
		   AND deleted_at IS NULL
		 ORDER BY created_at DESC`, tenantID, ciID)
	return rels, err
}

// ListAllByTenant returns every active relation for a tenant (for full topology).
func (r *CIRelationRepository) ListAllByTenant(ctx context.Context, tenantID string) ([]models.CIRelation, error) {
	var rels []models.CIRelation
	err := r.db.SelectContext(ctx, &rels,
		`SELECT * FROM ci_relations
		 WHERE tenant_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC`, tenantID)
	return rels, err
}

// Delete performs a soft delete on a single relation.
func (r *CIRelationRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ci_relations
		 SET deleted_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, id, tenantID)
	return err
}

// DeleteByCI soft-deletes every relation that references the given CI.
func (r *CIRelationRepository) DeleteByCI(ctx context.Context, tenantID, ciID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ci_relations
		 SET deleted_at = NOW()
		 WHERE tenant_id = $1 AND (source_ci_id = $2 OR target_ci_id = $2)
		   AND deleted_at IS NULL`, tenantID, ciID)
	return err
}

// Exists checks whether a relation of the given type already exists between
// two CIs (duplicate guard).
func (r *CIRelationRepository) Exists(ctx context.Context, tenantID, sourceID, targetID, relType string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(
			SELECT 1 FROM ci_relations
			WHERE tenant_id = $1 AND source_ci_id = $2 AND target_ci_id = $3
			  AND relation_type = $4 AND deleted_at IS NULL
		)`, tenantID, sourceID, targetID, relType)
	return exists, err
}

// CountByCI returns the number of active relations involving the given CI.
func (r *CIRelationRepository) CountByCI(ctx context.Context, tenantID, ciID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ci_relations
		 WHERE tenant_id = $1 AND (source_ci_id = $2 OR target_ci_id = $2)
		   AND deleted_at IS NULL`, tenantID, ciID)
	return count, err
}
