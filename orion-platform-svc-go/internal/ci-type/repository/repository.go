package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ci-type/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CI Types ---

func (r *Repository) CreateType(ctx context.Context, t *models.CIType) error {
	t.ID = uuid.New().String()
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ci_types (id, tenant_id, name, display_name, description, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :displayName, :description, :status, :createdAt, :updatedAt)`,
		t)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.CIType, error) {
	var t models.CIType
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM ci_types WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.CIType, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.Search != nil && *filter.Search != "" {
		where += fmt.Sprintf(" AND (name ILIKE $%d OR display_name ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+*filter.Search+"%")
		argIdx++
	}
	if filter.Limit != nil {
		where += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, *filter.Limit)
		argIdx++
	}
	if filter.Offset != nil {
		where += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, *filter.Offset)
	}
	var types []models.CIType
	err := r.db.SelectContext(ctx, &types,
		fmt.Sprintf(`SELECT * FROM ci_types %s ORDER BY created_at DESC`, where), args...)
	return types, err
}

func (r *Repository) UpdateType(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.CIType, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE ci_types SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) DeleteType(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM ci_types WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Attributes ---

func (r *Repository) ListAttributes(ctx context.Context, ciTypeID string, tenantID string) ([]models.CIAttribute, error) {
	var attrs []models.CIAttribute
	err := r.db.SelectContext(ctx, &attrs,
		`SELECT a.* FROM ci_type_attributes a
		 JOIN ci_types t ON a.ci_type_id = t.id
		 WHERE a.ci_type_id=$1 AND t.tenant_id=$2
		 ORDER BY a.name`, ciTypeID, tenantID)
	return attrs, err
}

func (r *Repository) UpsertAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CIAttribute) ([]models.CIAttribute, error) {
	// Verify the CI type exists and belongs to the tenant
	_, err := r.GetByID(ctx, ciTypeID, tenantID)
	if err != nil {
		return nil, err
	}
	// Remove all existing attributes for this type
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM ci_type_attributes WHERE ci_type_id=$1`, ciTypeID)
	if err != nil {
		return nil, err
	}
	// Insert new attributes
	now := time.Now().UTC()
	for i := range attrs {
		attrs[i].ID = uuid.New().String()
		attrs[i].CITypeID = ciTypeID
		attrs[i].CreatedAt = now
	}
	for _, attr := range attrs {
		_, err = r.db.NamedExecContext(ctx,
			`INSERT INTO ci_type_attributes (id, ci_type_id, name, type, required, default_value, created_at)
			 VALUES (:id, :ciTypeId, :name, :type, :required, :defaultValue, :createdAt)`,
			attr)
		if err != nil {
			return nil, err
		}
	}
	return r.ListAttributes(ctx, ciTypeID, tenantID)
}

// --- Versions ---

func (r *Repository) CreateVersion(ctx context.Context, v *models.CITypeVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	if v.AttributesSnapshot == "" {
		v.AttributesSnapshot = "[]"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ci_type_versions (id, ci_type_id, version, change_summary, attributes_snapshot, created_at)
		 VALUES (:id, :ciTypeId, :version, :changeSummary, :attributesSnapshot::jsonb, :createdAt)`,
		v)
	return err
}

func (r *Repository) ListVersions(ctx context.Context, ciTypeID string, tenantID string) ([]models.CITypeVersion, error) {
	// Verify the CI type exists and belongs to the tenant
	_, err := r.GetByID(ctx, ciTypeID, tenantID)
	if err != nil {
		return nil, err
	}
	var versions []models.CITypeVersion
	err = r.db.SelectContext(ctx, &versions,
		`SELECT * FROM ci_type_versions
		 WHERE ci_type_id=$1
		 ORDER BY created_at DESC`, ciTypeID)
	return versions, err
}

func (r *Repository) GetVersion(ctx context.Context, versionID string, ciTypeID string, tenantID string) (*models.CITypeVersion, error) {
	_, err := r.GetByID(ctx, ciTypeID, tenantID)
	if err != nil {
		return nil, err
	}
	var v models.CITypeVersion
	err = r.db.GetContext(ctx, &v,
		`SELECT * FROM ci_type_versions WHERE id=$1 AND ci_type_id=$2`, versionID, ciTypeID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// GetNextVersion returns the next version number for a CI type.
func (r *Repository) GetNextVersion(ctx context.Context, ciTypeID string) (string, error) {
	var maxVersion int
	err := r.db.GetContext(ctx, &maxVersion,
		`SELECT COALESCE(MAX(CAST(version AS INTEGER)), 0) FROM ci_type_versions WHERE ci_type_id=$1`, ciTypeID)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("v%d", maxVersion+1), nil
}

// --- Pagination filter ---

type ListFilter struct {
	Status  *string
	Search  *string
	Limit   *int
	Offset  *int
}
