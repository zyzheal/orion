package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/feature-flag-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed persistence for feature flags and toggle history.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// -------------------------------------------------------
// Feature Flags
// -------------------------------------------------------

// Create inserts a new feature flag row.
// SQL Call #1
func (r *Repository) Create(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO feature_flags (
			id, tenant_id, name, key, description, status, default_value,
			rollout_pct, rollout_strategy, targeting_rules, environments,
			tags, created_by, updated_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		f.ID, f.TenantID, f.Name, f.Key, f.Description, f.Status, f.DefaultValue,
		f.RolloutPct, f.RolloutStrategy, f.TargetingRules, f.Environments,
		f.Tags, f.CreatedBy, f.UpdatedBy, f.CreatedAt, f.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single feature flag by id and tenant_id.
// SQL Call #2
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM feature_flags WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// GetByKey retrieves a single feature flag by key and tenant_id.
// SQL Call #3
func (r *Repository) GetByKey(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM feature_flags WHERE key=$1 AND tenant_id=$2`, key, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// List retrieves feature flags for a tenant with optional status/environment filters, pagination.
// SQL Call #4
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag

	query := "SELECT * FROM feature_flags WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Status != nil {
			query += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, string(*filter.Status))
			argIdx++
		}
		if filter.Environment != nil {
			// Environments is stored as a JSON array; check if the given environment is contained.
			query += fmt.Sprintf(" AND environments @> $%d::jsonb", argIdx)
			args = append(args, fmt.Sprintf(`["%s"]`, *filter.Environment))
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Update modifies an existing feature flag row.
// SQL Call #5
func (r *Repository) Update(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE feature_flags SET
			name=$1, description=$2, status=$3, default_value=$4,
			rollout_pct=$5, rollout_strategy=$6, targeting_rules=$7,
			environments=$8, tags=$9, updated_by=$10, updated_at=NOW()
		WHERE id=$11 AND tenant_id=$12`,
		f.Name, f.Description, f.Status, f.DefaultValue,
		f.RolloutPct, f.RolloutStrategy, f.TargetingRules,
		f.Environments, f.Tags, f.UpdatedBy, f.ID, f.TenantID,
	)
	return err
}

// Delete removes a feature flag by id and tenant_id.
// SQL Call #6
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM feature_flags WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of feature flags for a tenant.
// SQL Call #7
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM feature_flags WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ListByEnvironment retrieves all active flags for a given environment (used by SDK evaluation).
// SQL Call #8
func (r *Repository) ListByEnvironment(ctx context.Context, tenantID, environment string) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM feature_flags WHERE tenant_id=$1 AND status='active' AND environments @> $2::jsonb ORDER BY key`,
		tenantID, fmt.Sprintf(`["%s"]`, environment))
	return items, err
}

// -------------------------------------------------------
// Toggle History
// -------------------------------------------------------

// InsertToggleRecord inserts a new toggle history entry.
// SQL Call #9
func (r *Repository) InsertToggleRecord(ctx context.Context, rec *models.FlagToggleRecord) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO flag_toggle_history (id, flag_id, old_value, new_value, changed_by, reason, changed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		rec.ID, rec.FlagID, rec.OldValue, rec.NewValue, rec.ChangedBy, rec.Reason, rec.ChangedAt,
	)
	return err
}

// ListToggleHistory retrieves toggle records for a flag, ordered by most recent first.
// SQL Call #10
func (r *Repository) ListToggleHistory(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error) {
	var items []models.FlagToggleRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM flag_toggle_history WHERE flag_id=$1 ORDER BY changed_at DESC LIMIT $2`,
		flagID, limit)
	return items, err
}

// ListByKeys retrieves multiple flags by their keys for a given tenant (batch evaluation).
// SQL Call #11
func (r *Repository) ListByKeys(ctx context.Context, tenantID string, keys []string) ([]models.FeatureFlag, error) {
	if len(keys) == 0 {
		return []models.FeatureFlag{}, nil
	}
	var items []models.FeatureFlag
	query, args, err := sqlx.In(`SELECT * FROM feature_flags WHERE tenant_id=? AND key IN (?)`, tenantID, keys)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Search performs a text search across name, key, and description fields.
// SQL Call #12
func (r *Repository) Search(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag
	searchPattern := "%" + strings.ToLower(query) + "%"
	err := r.db.SelectContext(ctx, &items, `
		SELECT * FROM feature_flags
		WHERE tenant_id=$1
		  AND (LOWER(name) LIKE $2 OR LOWER(key) LIKE $2 OR LOWER(description) LIKE $2)
		ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, searchPattern, offset, limit)
	return items, err
}
