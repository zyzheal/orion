// Package repository provides data access for CMDB relationship entities.
// Implements PostgreSQL-backed storage via sqlx for cmdb_relationship_types
// and cmdb_relationships tables.
//
// Follows the platform's established repository pattern (runner, backup,
// infrastructure domains): sqlx.DB, context-aware, tenant-scoped queries.
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-relationship/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for relationship types and relationship records.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Relationship Type CRUD
// ===========================================================================

// CreateRelationshipType inserts a new relationship type. Generates UUID for id.
func (r *Repository) CreateRelationshipType(ctx context.Context, rt *models.CMDBRelationshipType) error {
	if rt.ID == "" {
		rt.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	rt.CreatedAt = now
	rt.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_relationship_types
			(id, tenant_id, name, description, source_type, target_type,
			 cardinality, bidirectional, inverse_name, icon, color,
			 attributes, enabled, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		rt.ID, rt.TenantID, rt.Name, rt.Description, rt.SourceType, rt.TargetType,
		rt.Cardinality, rt.Bidirectional, rt.InverseName, rt.Icon, rt.Color,
		rt.Attributes, rt.Enabled, rt.Status, rt.CreatedAt, rt.UpdatedAt,
	)
	return err
}

// GetRelationshipType returns a relationship type by id, scoped to tenant.
func (r *Repository) GetRelationshipType(ctx context.Context, tenantID, id string) (*models.CMDBRelationshipType, error) {
	var rt models.CMDBRelationshipType
	err := r.db.GetContext(ctx, &rt,
		`SELECT id, tenant_id, name, description, source_type, target_type,
		        cardinality, bidirectional, inverse_name, icon, color,
		        attributes, enabled, status, created_at, updated_at
		 FROM cmdb_relationship_types
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &rt, nil
}

// ListRelationshipTypes returns relationship types for a tenant, filtered by status and enabled flag.
func (r *Repository) ListRelationshipTypes(ctx context.Context, tenantID, status string, enabled *bool) ([]models.CMDBRelationshipType, error) {
	var items []models.CMDBRelationshipType

	query := `SELECT id, tenant_id, name, description, source_type, target_type,
		        cardinality, bidirectional, inverse_name, icon, color,
		        attributes, enabled, status, created_at, updated_at
			 FROM cmdb_relationship_types
			 WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if enabled != nil {
		query += fmt.Sprintf(" AND enabled = $%d", argIdx)
		args = append(args, *enabled)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateRelationshipType updates mutable fields using a dynamic SET clause.
func (r *Repository) UpdateRelationshipType(ctx context.Context, id string, req *models.UpdateRelationshipTypeRequest) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Cardinality != nil {
		setClauses = append(setClauses, fmt.Sprintf("cardinality = $%d", argIdx))
		args = append(args, *req.Cardinality)
		argIdx++
	}
	if req.Bidirectional != nil {
		setClauses = append(setClauses, fmt.Sprintf("bidirectional = $%d", argIdx))
		args = append(args, *req.Bidirectional)
		argIdx++
	}
	if req.InverseName != nil {
		setClauses = append(setClauses, fmt.Sprintf("inverse_name = $%d", argIdx))
		args = append(args, *req.InverseName)
		argIdx++
	}
	if req.Icon != nil {
		setClauses = append(setClauses, fmt.Sprintf("icon = $%d", argIdx))
		args = append(args, *req.Icon)
		argIdx++
	}
	if req.Color != nil {
		setClauses = append(setClauses, fmt.Sprintf("color = $%d", argIdx))
		args = append(args, *req.Color)
		argIdx++
	}
	if req.Attributes != nil {
		setClauses = append(setClauses, fmt.Sprintf("attributes = $%d", argIdx))
		attrs := *req.Attributes
		args = append(args, attrs)
		argIdx++
	}
	if req.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *req.Enabled)
		argIdx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE cmdb_relationship_types SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteRelationshipType soft-deletes a type (sets status=deprecated, enabled=false).
func (r *Repository) DeleteRelationshipType(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_relationship_types
		 SET status = $1, enabled = $2, updated_at = now()
		 WHERE id = $3 AND tenant_id = $4`,
		"deprecated", false, id, tenantID,
	)
	return err
}

// CountRelationshipTypes returns type count for a tenant.
func (r *Repository) CountRelationshipTypes(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_relationship_types WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// ===========================================================================
// Relationship CRUD
// ===========================================================================

// CreateRelationship inserts a new relationship record.
func (r *Repository) CreateRelationship(ctx context.Context, rel *models.CMDBRelationship) error {
	if rel.ID == "" {
		rel.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	rel.CreatedAt = now
	rel.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_relationships
			(id, tenant_id, source_id, target_id, type_id, attributes, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		rel.ID, rel.TenantID, rel.SourceID, rel.TargetID, rel.TypeID,
		rel.Attributes, rel.CreatedAt, rel.UpdatedAt,
	)
	return err
}

// GetRelationship returns a single relationship by id, scoped to tenant.
func (r *Repository) GetRelationship(ctx context.Context, tenantID, id string) (*models.CMDBRelationship, error) {
	var rel models.CMDBRelationship
	err := r.db.GetContext(ctx, &rel,
		`SELECT id, tenant_id, source_id, target_id, type_id, attributes, created_at, updated_at
		 FROM cmdb_relationships
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &rel, nil
}

// GetRelationships returns relationships connected to a CI, filtered by direction.
// direction: "outbound" (source=ciID), "inbound" (target=ciID), "both".
func (r *Repository) GetRelationships(ctx context.Context, tenantID, ciID, direction string) ([]models.CMDBRelationship, error) {
	var items []models.CMDBRelationship

	switch direction {
	case "outbound":
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, source_id, target_id, type_id, attributes, created_at, updated_at
			 FROM cmdb_relationships
			 WHERE tenant_id = $1 AND source_id = $2
			 ORDER BY created_at DESC`,
			tenantID, ciID,
		)
		return items, err
	case "inbound":
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, source_id, target_id, type_id, attributes, created_at, updated_at
			 FROM cmdb_relationships
			 WHERE tenant_id = $1 AND target_id = $2
			 ORDER BY created_at DESC`,
			tenantID, ciID,
		)
		return items, err
	default: // "both"
		err := r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, source_id, target_id, type_id, attributes, created_at, updated_at
			 FROM cmdb_relationships
			 WHERE tenant_id = $1 AND (source_id = $2 OR target_id = $2)
			 ORDER BY created_at DESC`,
			tenantID, ciID,
		)
		return items, err
	}
}

// DeleteRelationship removes a relationship record.
func (r *Repository) DeleteRelationship(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_relationships WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// CountRelationships returns relationship count for a tenant CI.
func (r *Repository) CountRelationships(ctx context.Context, tenantID, ciID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_relationships
		 WHERE tenant_id = $1 AND (source_id = $2 OR target_id = $2)`,
		tenantID, ciID,
	)
	return count, err
}

// ===========================================================================
// Helpers
// ===========================================================================

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
