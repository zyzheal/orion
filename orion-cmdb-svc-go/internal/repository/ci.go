package repository

import (
	"context"
	"fmt"
	"strings"

	"orion-cmdb-svc-go/internal/models"

	"orion/go-common/pkg/database"
)

// CIRepository handles all database operations for the ci_items table.
// Every query scopes by tenant_id and excludes soft-deleted rows
// unless explicitly noted.
type CIRepository struct {
	db *database.DB
}

func NewCIRepository(db *database.DB) *CIRepository {
	return &CIRepository{db: db}
}

// Create inserts a new CI item. Version is always 1 on creation.
func (r *CIRepository) Create(ctx context.Context, item *models.CIItem) error {
	query := `INSERT INTO ci_items
		(id, tenant_id, name, ci_type, description, status, environment, tags, owner, attributes, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query,
		item.ID, item.TenantID, item.Name, item.CIType,
		item.Description, item.Status, item.Environment,
		item.Tags, item.Owner, item.Attributes, item.Version,
	)
	return err
}

// GetByID returns a single CI by its UUID, scoped to a tenant and excluding
// soft-deleted rows.
func (r *CIRepository) GetByID(ctx context.Context, id, tenantID string) (*models.CIItem, error) {
	var item models.CIItem
	err := r.db.GetContext(ctx, &item,
		`SELECT * FROM ci_items
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// Exists checks whether a CI with the same name and type already exists
// for a given tenant (duplicate guard).
func (r *CIRepository) Exists(ctx context.Context, tenantID, name, ciType string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(
			SELECT 1 FROM ci_items
			WHERE tenant_id = $1 AND name = $2 AND ci_type = $3 AND deleted_at IS NULL
		)`, tenantID, name, ciType)
	return exists, err
}

// List returns a paginated, filtered list of CIs.
// Supports filtering by ci_type, status, environment, tags (ANY match),
// and free-text search across name and description.
func (r *CIRepository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.CIItem, int, error) {
	var items []models.CIItem
	var total int

	var conditions []string
	args := []any{tenantID}
	argIdx := 2

	// Always exclude soft-deleted rows
	conditions = append(conditions, "deleted_at IS NULL")

	if q.CIType != "" {
		conditions = append(conditions, fmt.Sprintf("ci_type = $%d", argIdx))
		args = append(args, q.CIType)
		argIdx++
	}
	if q.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}
	if q.Environment != "" {
		conditions = append(conditions, fmt.Sprintf("environment = $%d", argIdx))
		args = append(args, q.Environment)
		argIdx++
	}
	if q.Tags != "" {
		// Comma-separated tags: match if ANY tag in the list is present
		tagList := strings.Split(q.Tags, ",")
		trimmed := make([]string, 0, len(tagList))
		for _, t := range tagList {
			t = strings.TrimSpace(t)
			if t != "" {
				trimmed = append(trimmed, t)
			}
		}
		if len(trimmed) > 0 {
			conditions = append(conditions, fmt.Sprintf("tags && $%d", argIdx))
			args = append(args, trimmed)
			argIdx++
		}
	}
	if q.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	} else if q.Name != "" {
		conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", argIdx))
		args = append(args, "%"+q.Name+"%")
		argIdx++
	}

	where := "WHERE tenant_id = $1 AND " + strings.Join(conditions, " AND ")

	// Whitelist order-by columns to prevent SQL injection
	allowedOrder := map[string]bool{
		"created_at": true, "updated_at": true, "name": true, "ci_type": true, "status": true,
	}
	orderCol := "created_at"
	if allowedOrder[q.OrderBy] {
		orderCol = q.OrderBy
	}
	orderDir := "DESC"
	if strings.ToUpper(q.Order) == "ASC" {
		orderDir = "ASC"
	}

	countQuery := "SELECT COUNT(*) FROM ci_items " + where
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	listQuery := fmt.Sprintf(
		"SELECT * FROM ci_items %s ORDER BY %s %s LIMIT %d OFFSET %d",
		where, orderCol, orderDir, q.PageSize, offset,
	)
	if err := r.db.SelectContext(ctx, &items, listQuery, args...); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// Update modifies an existing CI. The caller is responsible for bumping
// the Version field before calling this method.
func (r *CIRepository) Update(ctx context.Context, item *models.CIItem) error {
	query := `UPDATE ci_items
		SET name=$1, ci_type=$2, description=$3, status=$4, environment=$5,
		    tags=$6, owner=$7, attributes=$8, version=$9, updated_at=NOW()
		WHERE id=$10 AND tenant_id=$11 AND deleted_at IS NULL`
	_, err := r.db.ExecContext(ctx, query,
		item.Name, item.CIType, item.Description,
		item.Status, item.Environment, item.Tags,
		item.Owner, item.Attributes, item.Version,
		item.ID, item.TenantID,
	)
	return err
}

// Delete performs a soft delete: sets deleted_at and status to 'decommissioned'.
func (r *CIRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ci_items
		 SET deleted_at = NOW(), status = 'decommissioned', updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, id, tenantID)
	return err
}

// Count returns the number of non-deleted CIs for a tenant.
func (r *CIRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ci_items WHERE tenant_id = $1 AND deleted_at IS NULL`, tenantID)
	return count, err
}

// ---------------------------------------------------------------------------
// Version history methods
// ---------------------------------------------------------------------------

// CreateVersion inserts a version snapshot for a CI.
func (r *CIRepository) CreateVersion(ctx context.Context, v *models.CIVersion) error {
	query := `INSERT INTO ci_versions (id, ci_id, version, changes, data, actor)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query,
		v.ID, v.CIID, v.Version, v.Changes, v.Data, v.Actor)
	return err
}

// GetVersions returns all version records for a CI, newest first.
func (r *CIRepository) GetVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	var versions []models.CIVersion
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM ci_versions WHERE ci_id = $1 ORDER BY version DESC`, ciID)
	return versions, err
}

// GetVersion returns a specific version record for a CI.
func (r *CIRepository) GetVersion(ctx context.Context, ciID string, version int) (*models.CIVersion, error) {
	var v models.CIVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM ci_versions WHERE ci_id = $1 AND version = $2`, ciID, version)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// GetCurrentVersion returns the current version number of a CI.
func (r *CIRepository) GetCurrentVersion(ctx context.Context, id, tenantID string) (int, error) {
	var version int
	err := r.db.GetContext(ctx, &version,
		`SELECT version FROM ci_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, id, tenantID)
	return version, err
}

// ListAllByTenant returns every non-deleted CI for a tenant (used for topology
// graph construction where pagination is not desired).
func (r *CIRepository) ListAllByTenant(ctx context.Context, tenantID string) ([]models.CIItem, error) {
	var items []models.CIItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM ci_items
		 WHERE tenant_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC`, tenantID)
	return items, err
}
