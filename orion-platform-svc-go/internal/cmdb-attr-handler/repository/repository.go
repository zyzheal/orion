// Package repository provides data access for CMDB attribute value entities.
// Implements PostgreSQL-backed storage via sqlx for the cmdb_attribute_values table.
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-attr-handler/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = sql.ErrNoRows
)

// Repository provides data access for CMDB attribute values.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new attribute value. Generates UUID for id.
func (r *Repository) Create(ctx context.Context, a *models.CMDBAttributeValue) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_attribute_values
			(id, tenant_id, ci_id, attribute_id, value, type, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		a.ID, a.TenantID, a.CIID, a.AttributeID, a.Value, a.Type,
		a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// Get returns an attribute value by its unique key (tenant_id, ci_id, attribute_id).
func (r *Repository) Get(ctx context.Context, tenantID, ciID, attrID string) (*models.CMDBAttributeValue, error) {
	var a models.CMDBAttributeValue
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, ci_id, attribute_id, value, type, created_at, updated_at
		 FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2 AND attribute_id = $3`,
		tenantID, ciID, attrID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// Update updates the value and type for an existing attribute value.
func (r *Repository) Update(ctx context.Context, tenantID, ciID, attrID, value, attrType string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_attribute_values
		 SET value = $1, type = $2, updated_at = $3
		 WHERE tenant_id = $4 AND ci_id = $5 AND attribute_id = $6`,
		value, attrType, now, tenantID, ciID, attrID,
	)
	return err
}

// Delete removes an attribute value.
func (r *Repository) Delete(ctx context.Context, tenantID, ciID, attrID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2 AND attribute_id = $3`,
		tenantID, ciID, attrID,
	)
	return err
}

// ListByCI returns all attribute values for a CI, paginated.
func (r *Repository) ListByCI(ctx context.Context, tenantID, ciID string, offset, limit int) ([]models.CMDBAttributeValue, error) {
	var items []models.CMDBAttributeValue
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, ci_id, attribute_id, value, type, created_at, updated_at
		 FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2
		 ORDER BY attribute_id
		 OFFSET $3 LIMIT $4`,
		tenantID, ciID, offset, limit,
	)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// CountByCI returns the number of attribute values for a CI.
func (r *Repository) CountByCI(ctx context.Context, tenantID, ciID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2`,
		tenantID, ciID,
	)
	return count, err
}

// Upsert performs an upsert: inserts or updates an existing attribute value.
func (r *Repository) Upsert(ctx context.Context, tenantID, ciID, attrID, value, attrType string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_attribute_values
			(id, tenant_id, ci_id, attribute_id, value, type, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 ON CONFLICT (tenant_id, ci_id, attribute_id)
		 DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, updated_at = $9`,
		uuid.New().String(), tenantID, ciID, attrID, value, attrType,
		now, now, now,
	)
	return err
}

// DeleteByCI removes all attribute values for a CI.
func (r *Repository) DeleteByCI(ctx context.Context, tenantID, ciID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2`,
		tenantID, ciID,
	)
	return err
}

// Exists checks whether an attribute value exists for the given key.
func (r *Repository) Exists(ctx context.Context, tenantID, ciID, attrID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT TRUE FROM cmdb_attribute_values
		 WHERE tenant_id = $1 AND ci_id = $2 AND attribute_id = $3`,
		tenantID, ciID, attrID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check attribute value existence failed: %w", err)
	}
	return true, nil
}
