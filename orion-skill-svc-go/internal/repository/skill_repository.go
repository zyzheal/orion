package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/skill-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides all database operations for the skill domain.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// =====================================================================
// Skill Packages
// =====================================================================

// CreateSkill inserts a new skill package and returns the created row.
func (r *Repository) CreateSkill(ctx context.Context, d *models.SkillPackage) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skill_packages
			(id, name, version, description, category, tags, author, status,
			 schema, capabilities, schemas, is_version_locked, install_count,
			 rating, rating_count)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		d.ID, d.Name, d.Version, d.Description, d.Category, d.Tags,
		d.Author, d.Status, d.Schema, d.Capabilities, d.Schemas,
		d.IsVersionLocked, d.InstallCount, d.Rating, d.RatingCount,
	)
	return err
}

// FindSkillByID returns a skill package by primary key.
func (r *Repository) FindSkillByID(ctx context.Context, id string) (*models.SkillPackage, error) {
	var d models.SkillPackage
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM skill_packages WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindSkillByName returns a skill package by unique name.
func (r *Repository) FindSkillByName(ctx context.Context, name string) (*models.SkillPackage, error) {
	var d models.SkillPackage
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM skill_packages WHERE name = $1`, name)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListSkills returns a filtered, paginated list of skill packages.
func (r *Repository) ListSkills(ctx context.Context, opts ListSkillsOpts) ([]models.SkillPackage, error) {
	query, args := buildListSkillsQuery(opts)
	var items []models.SkillPackage
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CountSkills returns the total count matching the optional filters.
func (r *Repository) CountSkills(ctx context.Context, status, category string) (int, error) {
	var count int
	query, args := buildCountSkillsQuery(status, category)
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// UpdateSkill applies a partial update to a skill package.
func (r *Repository) UpdateSkill(ctx context.Context, id string, input *models.UpdateSkillRequest) (*models.SkillPackage, error) {
	sets, args := buildSkillUpdateSets(input)
	if len(sets) == 0 {
		return r.FindSkillByID(ctx, id)
	}
	args = append(args, id)
	query := fmt.Sprintf(
		`UPDATE skill_packages SET %s, updated_at = NOW() WHERE id = $%d RETURNING *`,
		strings.Join(sets, ", "), len(args),
	)
	var d models.SkillPackage
	if err := r.db.GetContext(ctx, &d, query, args...); err != nil {
		return nil, err
	}
	return &d, nil
}

// DeleteSkill performs a soft-delete (sets status='uninstalled').
func (r *Repository) DeleteSkill(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE skill_packages SET status = 'uninstalled', updated_at = NOW() WHERE id = $1`, id)
	return err
}

// IncrementInstallCount atomically increments install_count.
func (r *Repository) IncrementInstallCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE skill_packages SET install_count = install_count + 1 WHERE id = $1`, id)
	return err
}

// SearchSkills returns published skills matching a name/description ILIKE pattern.
func (r *Repository) SearchSkills(ctx context.Context, query string, limit int) ([]models.SkillPackage, error) {
	var items []models.SkillPackage
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_packages
		 WHERE status = 'published'
		   AND (name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
		 ORDER BY install_count DESC, rating DESC
		 LIMIT $2`, query, limit)
	return items, err
}

// GetCategories returns published skill category counts.
func (r *Repository) GetCategories(ctx context.Context) ([]models.CategoryCount, error) {
	var items []models.CategoryCount
	err := r.db.SelectContext(ctx, &items,
		`SELECT category, COUNT(*)::INT AS count
		 FROM skill_packages WHERE status = 'published'
		 GROUP BY category ORDER BY count DESC`)
	return items, err
}

// FindPendingReview returns skills in review/submitted status.
func (r *Repository) FindPendingReview(ctx context.Context, limit, offset int, category string) ([]models.SkillPackage, int, error) {
	where, args := buildPendingReviewWhere(category)

	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_packages `+where, args...); err != nil {
		return nil, 0, err
	}

	argsPaged := append(args, limit, offset)
	query := fmt.Sprintf(
		`SELECT * FROM skill_packages %s ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1+1, len(args)-1+2,
	)
	// Re-derive param indices: args has N items, limit=$N+1, offset=$N+2
	n := len(args)
	query = fmt.Sprintf(
		`SELECT * FROM skill_packages %s ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
		where, n+1, n+2,
	)
	var items []models.SkillPackage
	if err := r.db.SelectContext(ctx, &items, query, argsPaged...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateSkillRating recalculates rating and rating_count from reviews.
func (r *Repository) UpdateSkillRating(ctx context.Context, skillID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE skill_packages SET
			rating       = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM skill_reviews WHERE skill_id = $1), 0),
			rating_count = (SELECT COUNT(*)::INT FROM skill_reviews WHERE skill_id = $1),
			updated_at   = NOW()
		WHERE id = $1`, skillID)
	return err
}

// =====================================================================
// Skill Versions
// =====================================================================

// CreateVersion inserts a new version and marks it as latest.
func (r *Repository) CreateVersion(ctx context.Context, v *models.SkillVersion) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear previous latest flag
	if _, err := tx.ExecContext(ctx,
		`UPDATE skill_versions SET is_latest = false WHERE skill_id = $1`, v.SkillID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO skill_versions
			(id, skill_id, version, changelog, schema, schema_snapshot,
			 is_latest, is_locked, released_at)
		VALUES ($1,$2,$3,$4,$5,$6,true,$7,NOW())`,
		v.ID, v.SkillID, v.Version, v.Changelog, v.Schema,
		v.SchemaSnapshot, v.IsLocked,
	); err != nil {
		return err
	}

	// Update skill package version
	if _, err := tx.ExecContext(ctx,
		`UPDATE skill_packages SET version = $1, updated_at = NOW() WHERE id = $2`,
		v.Version, v.SkillID); err != nil {
		return err
	}

	return tx.Commit()
}

// FindVersionsBySkill returns all versions for a skill, newest first.
func (r *Repository) FindVersionsBySkill(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	var items []models.SkillVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_versions WHERE skill_id = $1 ORDER BY created_at DESC`, skillID)
	return items, err
}

// FindLatestVersion returns the version marked is_latest=true.
func (r *Repository) FindLatestVersion(ctx context.Context, skillID string) (*models.SkillVersion, error) {
	var v models.SkillVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM skill_versions WHERE skill_id = $1 AND is_latest = true LIMIT 1`, skillID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// LockVersion sets is_locked=true on a version.
func (r *Repository) LockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	var v models.SkillVersion
	err := r.db.GetContext(ctx, &v, `
		UPDATE skill_versions
		SET is_locked = true, released_at = COALESCE(released_at, NOW())
		WHERE id = $1 RETURNING *`, versionID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// UnlockVersion sets is_locked=false on a version.
func (r *Repository) UnlockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	var v models.SkillVersion
	err := r.db.GetContext(ctx, &v,
		`UPDATE skill_versions SET is_locked = false WHERE id = $1 RETURNING *`, versionID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// =====================================================================
// Skill Instances
// =====================================================================

// CreateInstance inserts a new tenant-scoped skill instance.
func (r *Repository) CreateInstance(ctx context.Context, d *models.SkillInstance) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skill_instances
			(id, skill_id, tenant_id, project_id, name, description,
			 status, config, bindings, metadata, is_default, version, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		d.ID, d.SkillID, d.TenantID, d.ProjectID, d.Name, d.Description,
		d.Status, d.Config, d.Bindings, d.Metadata, d.IsDefault, d.Version, d.CreatedBy,
	)
	return err
}

// FindInstanceByID returns an instance by primary key.
// DEPRECATED: Use FindInstanceByIDAndTenant with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) FindInstanceByID(ctx context.Context, id string) (*models.SkillInstance, error) {
	var d models.SkillInstance
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM skill_instances WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindInstanceByIDAndTenant returns an instance scoped to a tenant.
func (r *Repository) FindInstanceByIDAndTenant(ctx context.Context, id, tenantID string) (*models.SkillInstance, error) {
	var d models.SkillInstance
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM skill_instances WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindInstancesBySkill returns all instances for a skill within a tenant.
func (r *Repository) FindInstancesBySkill(ctx context.Context, skillID, tenantID string) ([]models.SkillInstance, error) {
	var items []models.SkillInstance
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_instances
		 WHERE skill_id = $1 AND tenant_id = $2
		 ORDER BY is_default DESC, name`, skillID, tenantID)
	return items, err
}

// FindInstancesByTenant returns paginated instances for a tenant.
func (r *Repository) FindInstancesByTenant(ctx context.Context, tenantID string, limit, offset int) ([]models.SkillInstance, int, error) {
	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_instances WHERE tenant_id = $1`, tenantID); err != nil {
		return nil, 0, err
	}

	var items []models.SkillInstance
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_instances
		 WHERE tenant_id = $1
		 ORDER BY is_default DESC, updated_at DESC
		 LIMIT $2 OFFSET $3`, tenantID, limit, offset); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateInstance applies a partial update to a skill instance, scoped to tenant.
func (r *Repository) UpdateInstance(ctx context.Context, tenantID, id string, input *models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	sets, args := buildInstanceUpdateSets(input)
	if len(sets) == 0 {
		return r.FindInstanceByIDAndTenant(ctx, id, tenantID)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(
		`UPDATE skill_instances SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d RETURNING *`,
		strings.Join(sets, ", "), len(args)-1, len(args),
	)
	var d models.SkillInstance
	if err := r.db.GetContext(ctx, &d, query, args...); err != nil {
		return nil, err
	}
	return &d, nil
}

// DeleteInstance hard-deletes an instance, scoped to tenant.
func (r *Repository) DeleteInstance(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM skill_instances WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// =====================================================================
// Skill Reviews
// =====================================================================

// UpsertReview inserts or updates a review (unique on skill_id, user_id).
func (r *Repository) UpsertReview(ctx context.Context, d *models.SkillReview) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skill_reviews (id, skill_id, user_id, rating, comment)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (skill_id, user_id)
		DO UPDATE SET rating = $4, comment = $5`,
		d.ID, d.SkillID, d.UserID, d.Rating, d.Comment,
	)
	return err
}

// FindReviewsBySkill returns all reviews for a skill, newest first.
func (r *Repository) FindReviewsBySkill(ctx context.Context, skillID string) ([]models.SkillReview, error) {
	var items []models.SkillReview
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_reviews WHERE skill_id = $1 ORDER BY created_at DESC`, skillID)
	return items, err
}

// =====================================================================
// Skill Executions
// =====================================================================

// CreateExecution inserts a new execution record.
func (r *Repository) CreateExecution(ctx context.Context, d *models.SkillExecution) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skill_executions
			(id, tenant_id, skill_id, instance_id, capability,
			 status, input, triggered_by, trigger_mode, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.SkillID, d.InstanceID, d.Capability,
		d.Status, d.Input, d.TriggeredBy, d.TriggerMode, d.Metadata,
	)
	return err
}

// FindExecutionByID returns an execution by primary key, scoped to tenant.
func (r *Repository) FindExecutionByID(ctx context.Context, tenantID, id string) (*models.SkillExecution, error) {
	var d models.SkillExecution
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM skill_executions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// UpdateExecution applies a partial update to an execution record, scoped to tenant.
func (r *Repository) UpdateExecution(ctx context.Context, tenantID, id string, input *models.UpdateExecutionRequest) (*models.SkillExecution, error) {
	sets, args := buildExecutionUpdateSets(input)
	if len(sets) == 0 {
		return r.FindExecutionByID(ctx, tenantID, id)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(
		`UPDATE skill_executions SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *`,
		strings.Join(sets, ", "), len(args)-1, len(args),
	)
	var d models.SkillExecution
	if err := r.db.GetContext(ctx, &d, query, args...); err != nil {
		return nil, err
	}
	return &d, nil
}

// FindExecutionsBySkill returns paginated executions for a skill within a tenant.
func (r *Repository) FindExecutionsBySkill(ctx context.Context, skillID, tenantID string, limit, offset int) ([]models.SkillExecution, int, error) {
	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_executions WHERE skill_id = $1 AND tenant_id = $2`,
		skillID, tenantID); err != nil {
		return nil, 0, err
	}
	var items []models.SkillExecution
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_executions
		 WHERE skill_id = $1 AND tenant_id = $2
		 ORDER BY started_at DESC LIMIT $3 OFFSET $4`,
		skillID, tenantID, limit, offset); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// FindExecutionsByTenant returns paginated executions for a tenant, optionally filtered by skill.
func (r *Repository) FindExecutionsByTenant(ctx context.Context, tenantID string, limit, offset int, skillID string) ([]models.SkillExecution, int, error) {
	where, args := buildExecutionsByTenantWhere(tenantID, skillID)

	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_executions `+where, args...); err != nil {
		return nil, 0, err
	}

	n := len(args)
	argsPaged := append(args, limit, offset)
	query := fmt.Sprintf(
		`SELECT * FROM skill_executions %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`,
		where, n+1, n+2,
	)
	var items []models.SkillExecution
	if err := r.db.SelectContext(ctx, &items, query, argsPaged...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// =====================================================================
// Skill Audit Logs
// =====================================================================

// CreateAuditLog inserts a new audit log entry.
func (r *Repository) CreateAuditLog(ctx context.Context, d *models.SkillAuditLog) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skill_audit_logs
			(id, skill_id, action, actor_id, actor_name,
			 old_status, new_status, reason, changes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.SkillID, d.Action, d.ActorID, d.ActorName,
		d.OldStatus, d.NewStatus, d.Reason, d.Changes,
	)
	return err
}

// FindAuditLogsBySkill returns paginated audit logs for a skill.
func (r *Repository) FindAuditLogsBySkill(ctx context.Context, skillID string, limit, offset int) ([]models.SkillAuditLog, int, error) {
	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_audit_logs WHERE skill_id = $1`, skillID); err != nil {
		return nil, 0, err
	}
	var items []models.SkillAuditLog
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_audit_logs
		 WHERE skill_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		skillID, limit, offset); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// FindAllAuditLogs returns paginated audit logs across all skills.
func (r *Repository) FindAllAuditLogs(ctx context.Context, limit, offset int, action string) ([]models.SkillAuditLog, int, error) {
	where, args := buildAllAuditLogsWhere(action)

	var total int
	if err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*)::INT FROM skill_audit_logs `+where, args...); err != nil {
		return nil, 0, err
	}

	n := len(args)
	argsPaged := append(args, limit, offset)
	query := fmt.Sprintf(
		`SELECT * FROM skill_audit_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, n+1, n+2,
	)
	var items []models.SkillAuditLog
	if err := r.db.SelectContext(ctx, &items, query, argsPaged...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// =====================================================================
// Query Builders (unexported)
// =====================================================================

// ListSkillsOpts carries optional filters for ListSkills.
type ListSkillsOpts struct {
	Status   string
	Category string
	Tags     []string
	Limit    int
	Offset   int
}

func buildListSkillsQuery(opts ListSkillsOpts) (string, []interface{}) {
	var conds []string
	var args []interface{}
	i := 1

	if opts.Status != "" {
		args = append(args, opts.Status)
		conds = append(conds, fmt.Sprintf("status = $%d", i))
		i++
	}
	if opts.Category != "" {
		args = append(args, opts.Category)
		conds = append(conds, fmt.Sprintf("category = $%d", i))
		i++
	}
	if len(opts.Tags) > 0 {
		args = append(args, opts.Tags)
		conds = append(conds, fmt.Sprintf("tags && $%d", i))
		i++
	}

	q := "SELECT * FROM skill_packages"
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	q += " ORDER BY install_count DESC, rating DESC"

	if opts.Limit > 0 {
		args = append(args, opts.Limit)
		q += fmt.Sprintf(" LIMIT $%d", i)
		i++
	}
	if opts.Offset > 0 {
		args = append(args, opts.Offset)
		q += fmt.Sprintf(" OFFSET $%d", i)
	}
	return q, args
}

func buildCountSkillsQuery(status, category string) (string, []interface{}) {
	var conds []string
	var args []interface{}
	i := 1

	if status != "" {
		args = append(args, status)
		conds = append(conds, fmt.Sprintf("status = $%d", i))
		i++
	}
	if category != "" {
		args = append(args, category)
		conds = append(conds, fmt.Sprintf("category = $%d", i))
	}

	q := "SELECT COUNT(*)::INT FROM skill_packages"
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	return q, args
}

func buildSkillUpdateSets(input *models.UpdateSkillRequest) ([]string, []interface{}) {
	var sets []string
	var args []interface{}
	i := 1

	if input.Name != nil {
		args = append(args, *input.Name)
		sets = append(sets, fmt.Sprintf("name = $%d", i))
		i++
	}
	if input.Description != nil {
		args = append(args, *input.Description)
		sets = append(sets, fmt.Sprintf("description = $%d", i))
		i++
	}
	if input.Category != nil {
		args = append(args, *input.Category)
		sets = append(sets, fmt.Sprintf("category = $%d", i))
		i++
	}
	if input.Tags != nil {
		args = append(args, input.Tags)
		sets = append(sets, fmt.Sprintf("tags = $%d", i))
		i++
	}
	if input.Status != nil {
		args = append(args, *input.Status)
		sets = append(sets, fmt.Sprintf("status = $%d", i))
		i++
	}
	if input.Schema != nil {
		args = append(args, input.Schema)
		sets = append(sets, fmt.Sprintf("schema = $%d", i))
		i++
	}
	if input.Capabilities != nil {
		args = append(args, input.Capabilities)
		sets = append(sets, fmt.Sprintf("capabilities = $%d", i))
		i++
	}
	if input.Schemas != nil {
		args = append(args, input.Schemas)
		sets = append(sets, fmt.Sprintf("schemas = $%d", i))
		i++
	}
	if input.IsVersionLocked != nil {
		args = append(args, *input.IsVersionLocked)
		sets = append(sets, fmt.Sprintf("is_version_locked = $%d", i))
	}
	return sets, args
}

func buildInstanceUpdateSets(input *models.UpdateInstanceRequest) ([]string, []interface{}) {
	var sets []string
	var args []interface{}
	i := 1

	if input.Name != nil {
		args = append(args, *input.Name)
		sets = append(sets, fmt.Sprintf("name = $%d", i))
		i++
	}
	if input.Description != nil {
		args = append(args, *input.Description)
		sets = append(sets, fmt.Sprintf("description = $%d", i))
		i++
	}
	if input.Config != nil {
		args = append(args, input.Config)
		sets = append(sets, fmt.Sprintf("config = $%d", i))
		i++
	}
	if input.Bindings != nil {
		args = append(args, input.Bindings)
		sets = append(sets, fmt.Sprintf("bindings = $%d", i))
		i++
	}
	if input.Metadata != nil {
		args = append(args, input.Metadata)
		sets = append(sets, fmt.Sprintf("metadata = $%d", i))
		i++
	}
	if input.IsDefault != nil {
		args = append(args, *input.IsDefault)
		sets = append(sets, fmt.Sprintf("is_default = $%d", i))
		i++
	}
	if input.Status != nil {
		args = append(args, *input.Status)
		sets = append(sets, fmt.Sprintf("status = $%d", i))
		i++
	}
	if input.ProjectID != nil {
		args = append(args, *input.ProjectID)
		sets = append(sets, fmt.Sprintf("project_id = $%d", i))
	}
	return sets, args
}

func buildExecutionUpdateSets(input *models.UpdateExecutionRequest) ([]string, []interface{}) {
	var sets []string
	var args []interface{}
	i := 1

	if input.Status != nil {
		args = append(args, *input.Status)
		sets = append(sets, fmt.Sprintf("status = $%d", i))
		i++
	}
	if input.Output != nil {
		args = append(args, input.Output)
		sets = append(sets, fmt.Sprintf("output = $%d", i))
		i++
	}
	if input.ErrorMessage != nil {
		args = append(args, *input.ErrorMessage)
		sets = append(sets, fmt.Sprintf("error_message = $%d", i))
		i++
	}
	if input.DurationMs != nil {
		args = append(args, *input.DurationMs)
		sets = append(sets, fmt.Sprintf("duration_ms = $%d", i))
		i++
	}
	// completed_at is set automatically when status becomes terminal
	if input.Status != nil && (*input.Status == "completed" || *input.Status == "failed") {
		sets = append(sets, "completed_at = NOW()")
	}
	return sets, args
}

func buildPendingReviewWhere(category string) (string, []interface{}) {
	conds := []string{"status IN ('review', 'submitted')"}
	var args []interface{}
	if category != "" {
		args = append(args, category)
		conds = append(conds, fmt.Sprintf("category = $%d", len(args)))
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

func buildExecutionsByTenantWhere(tenantID, skillID string) (string, []interface{}) {
	args := []interface{}{tenantID}
	conds := []string{"tenant_id = $1"}
	if skillID != "" {
		args = append(args, skillID)
		conds = append(conds, fmt.Sprintf("skill_id = $%d", len(args)))
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

func buildAllAuditLogsWhere(action string) (string, []interface{}) {
	var conds []string
	var args []interface{}
	if action != "" {
		args = append(args, action)
		conds = append(conds, fmt.Sprintf("action = $%d", len(args)))
	}
	if len(conds) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}
