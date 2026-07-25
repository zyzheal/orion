package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/param-types/models"

	"github.com/jmoiron/sqlx"
)

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// ScriptParamType CRUD
// ===========================================================================

func (r *Repository) Create(pt *models.ScriptParamType) error {
	_, err := r.db.Exec(`
		INSERT INTO script_param_types (id, tenant_id, name, code, label, category, default_value, validation, options, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		pt.ID, pt.TenantID, pt.Name, pt.Code, pt.Label, pt.Category,
		pt.DefaultVal, pt.Validation, pt.Options, pt.Enabled,
		pt.CreatedAt, pt.UpdatedAt)
	return err
}

func (r *Repository) Update(pt *models.ScriptParamType) error {
	_, err := r.db.Exec(`
		UPDATE script_param_types
		SET name=$1, label=$2, category=$3, default_value=$4, validation=$5, options=$6, enabled=$7, updated_at=$8
		WHERE id=$9`,
		pt.Name, pt.Label, pt.Category, pt.DefaultVal, pt.Validation, pt.Options,
		pt.Enabled, pt.UpdatedAt, pt.ID)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string) (*models.ScriptParamType, error) {
	var pt models.ScriptParamType
	err := r.db.GetContext(ctx, &pt, `SELECT * FROM script_param_types WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &pt, nil
}

func (r *Repository) GetByTenantAndCode(tenantID, code string) (*models.ScriptParamType, error) {
	var pt models.ScriptParamType
	err := r.db.Get(&pt, `SELECT * FROM script_param_types WHERE tenant_id=$1 AND code=$2`, tenantID, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &pt, nil
}

func (r *Repository) ListByTenant(tenantID string) ([]models.ScriptParamType, error) {
	var items []models.ScriptParamType
	err := r.db.Select(&items, `SELECT * FROM script_param_types WHERE tenant_id=$1 ORDER BY code`, tenantID)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM script_param_types WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountByTenant(tenantID string) (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM script_param_types WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ===========================================================================
// ScriptParamTemplate CRUD
// ===========================================================================

func (r *Repository) CreateParamTemplate(t *models.ScriptParamTemplate) error {
	_, err := r.db.Exec(`
		INSERT INTO script_param_templates (id, tenant_id, name, param_type, required, position, example, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		t.ID, t.TenantID, t.Name, t.ParamType, t.Required, t.Position, t.Example, t.CreatedAt)
	return err
}

func (r *Repository) GetParamTemplate(tenantID, id string) (*models.ScriptParamTemplate, error) {
	var t models.ScriptParamTemplate
	err := r.db.Get(&t, `SELECT * FROM script_param_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListParamTemplates(tenantID string, offset, limit int) ([]models.ScriptParamTemplate, error) {
	var items []models.ScriptParamTemplate
	err := r.db.Select(&items,
		`SELECT * FROM script_param_templates WHERE tenant_id=$1 ORDER BY position, created_at OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) DeleteParamTemplate(tenantID, id string) error {
	_, err := r.db.Exec(`DELETE FROM script_param_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ===========================================================================
// Seeding
// ===========================================================================

// SeedBuiltins inserts the 20 built-in param types for a tenant if they do not already exist.
func (r *Repository) SeedBuiltins(tenantID string) (int, error) {
	now := time.Now()
	count := 0
	for _, info := range models.ParamTypeCatalog() {
		exists, err := r.exists(tenantID, info.Code)
		if err != nil {
			return count, err
		}
		if exists {
			continue
		}
		pt := &models.ScriptParamType{
			ID:        "builtin:" + info.Code,
			TenantID:  tenantID,
			Name:      info.Name,
			Code:      info.Code,
			Label:     info.Label,
			Category:  info.Category,
			Enabled:   true,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := r.Create(pt); err != nil {
			// skip on duplicate key from concurrent seeding
			if isDuplicateKey(err) {
				continue
			}
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *Repository) exists(tenantID, code string) (bool, error) {
	var n int
	err := r.db.Get(&n, `SELECT COUNT(*) FROM script_param_types WHERE tenant_id=$1 AND code=$2`, tenantID, code)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func isDuplicateKey(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate")
}

// ===========================================================================
// Validation helper
// ===========================================================================

// EnsureTableExists is a no-op health check.
func (r *Repository) EnsureTableExists() error {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM information_schema.tables WHERE table_name='script_param_types'`)
	if err != nil {
		return fmt.Errorf("script_param_types table not found: %v", err)
	}
	return nil
}
