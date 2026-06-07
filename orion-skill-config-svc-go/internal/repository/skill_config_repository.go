package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/skill-config-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides all SQL operations for the skill-config domain.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Skill Packages ====================

// FindByID returns a skill package by ID.
func (r *Repository) FindByID(ctx context.Context, id string) (*models.SkillPackage, error) {
	var sp models.SkillPackage
	err := r.db.GetContext(ctx, &sp, `SELECT * FROM skill_packages WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("skill not found: %w", err)
	}
	return &sp, nil
}

// FindByName returns a skill package by name.
func (r *Repository) FindByName(ctx context.Context, name string) (*models.SkillPackage, error) {
	var sp models.SkillPackage
	err := r.db.GetContext(ctx, &sp, `SELECT * FROM skill_packages WHERE name = $1`, name)
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

// FindAll returns skill packages with optional filtering.
func (r *Repository) FindAll(ctx context.Context, status, category string, tags []string, limit, offset int) ([]models.SkillPackage, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if category != "" {
		conditions = append(conditions, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}
	if len(tags) > 0 {
		conditions = append(conditions, fmt.Sprintf("tags && $%d", argIdx))
		args = append(args, tags)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`SELECT * FROM skill_packages %s ORDER BY install_count DESC, rating DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var items []models.SkillPackage
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of skill packages matching filters.
func (r *Repository) Count(ctx context.Context, status, category string) (int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if category != "" {
		conditions = append(conditions, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var count int
	err := r.db.GetContext(ctx, &count, fmt.Sprintf(`SELECT COUNT(*) FROM skill_packages %s`, where), args...)
	return count, err
}

// Create inserts a new skill package and returns the created record.
func (r *Repository) Create(ctx context.Context, sp *models.SkillPackage) error {
	query := `
		INSERT INTO skill_packages (name, version, description, category, tags, author, status, schema, capabilities, schemas)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		sp.Name, sp.Version, sp.Description, sp.Category, sp.Tags,
		sp.Author, sp.Schema, sp.Capabilities, sp.Schemas,
	).Scan(&sp.ID, &sp.CreatedAt, &sp.UpdatedAt)
}

// Update modifies a skill package with the provided fields.
func (r *Repository) Update(ctx context.Context, id string, req *models.UpdateSkillRequest) (*models.SkillPackage, error) {
	var sets []string
	var args []interface{}
	argIdx := 1

	if req.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Category != nil {
		sets = append(sets, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, *req.Category)
		argIdx++
	}
	if req.Tags != nil {
		sets = append(sets, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, req.Tags)
		argIdx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if req.Schema != nil {
		sets = append(sets, fmt.Sprintf("schema = $%d", argIdx))
		args = append(args, req.Schema)
		argIdx++
	}
	if req.Capabilities != nil {
		sets = append(sets, fmt.Sprintf("capabilities = $%d", argIdx))
		args = append(args, req.Capabilities)
		argIdx++
	}
	if req.Schemas != nil {
		sets = append(sets, fmt.Sprintf("schemas = $%d", argIdx))
		args = append(args, req.Schemas)
		argIdx++
	}
	if req.IsVersionLocked != nil {
		sets = append(sets, fmt.Sprintf("is_version_locked = $%d", argIdx))
		args = append(args, *req.IsVersionLocked)
		argIdx++
	}

	if len(sets) == 0 {
		return r.FindByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(`UPDATE skill_packages SET %s WHERE id = $%d RETURNING *`, strings.Join(sets, ", "), argIdx)
	var sp models.SkillPackage
	err := r.db.GetContext(ctx, &sp, query, args...)
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

// Delete soft-deletes a skill package by setting status to 'uninstalled'.
func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE skill_packages SET status = 'uninstalled', updated_at = NOW() WHERE id = $1`, id)
	return err
}

// IncrementInstallCount increments the install counter.
func (r *Repository) IncrementInstallCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE skill_packages SET install_count = install_count + 1 WHERE id = $1`, id)
	return err
}

// Search finds published skills matching a query string.
func (r *Repository) Search(ctx context.Context, query string, limit int) ([]models.SkillPackage, error) {
	var items []models.SkillPackage
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_packages
		 WHERE status = 'published' AND (name ILIKE $1 OR description ILIKE $1)
		 ORDER BY install_count DESC, rating DESC LIMIT $2`,
		"%"+query+"%", limit)
	return items, err
}

// GetCategories returns published skill categories with counts.
func (r *Repository) GetCategories(ctx context.Context) ([]models.CategoryCount, error) {
	var items []models.CategoryCount
	err := r.db.SelectContext(ctx, &items,
		`SELECT category, COUNT(*) as count FROM skill_packages
		 WHERE status = 'published' GROUP BY category ORDER BY count DESC`)
	return items, err
}

// FindPendingReview returns skills pending review.
func (r *Repository) FindPendingReview(ctx context.Context, category string, limit, offset int) ([]models.SkillPackage, int, error) {
	where := "status IN ('review', 'submitted')"
	var args []interface{}
	argIdx := 1

	if category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM skill_packages WHERE %s`, where), countArgs...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`SELECT * FROM skill_packages WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	var items []models.SkillPackage
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}

// ==================== Skill Versions ====================

// FindVersions returns all versions for a skill.
func (r *Repository) FindVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	var items []models.SkillVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_versions WHERE skill_id = $1 ORDER BY created_at DESC`, skillID)
	return items, err
}

// FindLatestVersion returns the latest version for a skill.
func (r *Repository) FindLatestVersion(ctx context.Context, skillID string) (*models.SkillVersion, error) {
	var sv models.SkillVersion
	err := r.db.GetContext(ctx, &sv,
		`SELECT * FROM skill_versions WHERE skill_id = $1 AND is_latest = true LIMIT 1`, skillID)
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

// CreateVersion inserts a new skill version, clears previous latest flag, and updates the package version.
func (r *Repository) CreateVersion(ctx context.Context, sv *models.SkillVersion) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Clear previous latest flag
	if _, err := tx.ExecContext(ctx, `UPDATE skill_versions SET is_latest = false WHERE skill_id = $1`, sv.SkillID); err != nil {
		return err
	}

	// Insert new version
	query := `
		INSERT INTO skill_versions (skill_id, version, changelog, schema, schema_snapshot, is_latest, is_locked, released_at)
		VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
		RETURNING id, created_at`
	if err := tx.QueryRowContext(ctx, query,
		sv.SkillID, sv.Version, sv.Changelog, sv.Schema, sv.SchemaSnapshot, sv.IsLocked,
	).Scan(&sv.ID, &sv.CreatedAt); err != nil {
		return err
	}

	// Update skill package version
	if _, err := tx.ExecContext(ctx,
		`UPDATE skill_packages SET version = $1, updated_at = NOW() WHERE id = $2`,
		sv.Version, sv.SkillID); err != nil {
		return err
	}

	return tx.Commit()
}

// LockVersion locks a version to prevent modifications.
func (r *Repository) LockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	var sv models.SkillVersion
	err := r.db.GetContext(ctx, &sv,
		`UPDATE skill_versions SET is_locked = true, released_at = COALESCE(released_at, NOW())
		 WHERE id = $1 RETURNING *`, versionID)
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

// UnlockVersion unlocks a version to allow modifications.
func (r *Repository) UnlockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	var sv models.SkillVersion
	err := r.db.GetContext(ctx, &sv,
		`UPDATE skill_versions SET is_locked = false WHERE id = $1 RETURNING *`, versionID)
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

// ==================== Skill Reviews ====================

// FindReviews returns all reviews for a skill.
func (r *Repository) FindReviews(ctx context.Context, skillID string) ([]models.SkillReview, error) {
	var items []models.SkillReview
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_reviews WHERE skill_id = $1 ORDER BY created_at DESC`, skillID)
	return items, err
}

// CreateReview inserts or updates a review, then recalculates the skill rating.
func (r *Repository) CreateReview(ctx context.Context, rev *models.SkillReview) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Upsert review
	query := `
		INSERT INTO skill_reviews (skill_id, user_id, rating, comment)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (skill_id, user_id) DO UPDATE SET rating = $3, comment = $4
		RETURNING id, created_at`
	if err := tx.QueryRowContext(ctx, query,
		rev.SkillID, rev.UserID, rev.Rating, rev.Comment,
	).Scan(&rev.ID, &rev.CreatedAt); err != nil {
		return err
	}

	// Update skill rating
	if _, err := tx.ExecContext(ctx,
		`UPDATE skill_packages SET
		   rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM skill_reviews WHERE skill_id = $1),
		   rating_count = (SELECT COUNT(*) FROM skill_reviews WHERE skill_id = $1),
		   updated_at = NOW()
		 WHERE id = $1`, rev.SkillID); err != nil {
		return err
	}

	return tx.Commit()
}

// ==================== Skill Instances ====================

// CreateInstance inserts a new skill instance.
func (r *Repository) CreateInstance(ctx context.Context, inst *models.SkillInstance) error {
	query := `
		INSERT INTO skill_instances (skill_id, tenant_id, project_id, name, description, config, bindings, metadata, is_default, status, created_by, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'inactive', $10, $11)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		inst.SkillID, inst.TenantID, inst.ProjectID, inst.Name, inst.Description,
		inst.Config, inst.Bindings, inst.Metadata, inst.IsDefault, inst.CreatedBy, inst.Version,
	).Scan(&inst.ID, &inst.CreatedAt, &inst.UpdatedAt)
}

// FindInstanceByID returns an instance by ID.
func (r *Repository) FindInstanceByID(ctx context.Context, id string) (*models.SkillInstance, error) {
	var inst models.SkillInstance
	err := r.db.GetContext(ctx, &inst, `SELECT * FROM skill_instances WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// FindInstanceByIDAndTenant returns an instance scoped to a tenant.
func (r *Repository) FindInstanceByIDAndTenant(ctx context.Context, id, tenantID string) (*models.SkillInstance, error) {
	var inst models.SkillInstance
	err := r.db.GetContext(ctx, &inst,
		`SELECT * FROM skill_instances WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// FindInstancesBySkillID returns all instances for a skill within a tenant.
func (r *Repository) FindInstancesBySkillID(ctx context.Context, skillID, tenantID string) ([]models.SkillInstance, error) {
	var items []models.SkillInstance
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_instances WHERE skill_id = $1 AND tenant_id = $2 ORDER BY is_default DESC, name`,
		skillID, tenantID)
	return items, err
}

// FindInstancesByTenant returns paginated instances for a tenant.
func (r *Repository) FindInstancesByTenant(ctx context.Context, tenantID string, limit, offset int) ([]models.SkillInstance, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM skill_instances WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SkillInstance
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_instances WHERE tenant_id = $1 ORDER BY is_default DESC, updated_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, total, err
}

// UpdateInstance modifies a skill instance with the provided fields.
func (r *Repository) UpdateInstance(ctx context.Context, id string, req *models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	var sets []string
	var args []interface{}
	argIdx := 1

	if req.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Config != nil {
		sets = append(sets, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, req.Config)
		argIdx++
	}
	if req.IsDefault != nil {
		sets = append(sets, fmt.Sprintf("is_default = $%d", argIdx))
		args = append(args, *req.IsDefault)
		argIdx++
	}
	if req.ProjectID != nil {
		sets = append(sets, fmt.Sprintf("project_id = $%d", argIdx))
		args = append(args, *req.ProjectID)
		argIdx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}

	if len(sets) == 0 {
		return r.FindInstanceByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(`UPDATE skill_instances SET %s WHERE id = $%d RETURNING *`, strings.Join(sets, ", "), argIdx)
	var inst models.SkillInstance
	err := r.db.GetContext(ctx, &inst, query, args...)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// DeleteInstance removes a skill instance.
func (r *Repository) DeleteInstance(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM skill_instances WHERE id = $1`, id)
	return err
}

// ==================== Skill Executions ====================

// CreateExecution inserts a new execution record.
func (r *Repository) CreateExecution(ctx context.Context, exec *models.SkillExecution) error {
	query := `
		INSERT INTO skill_executions (tenant_id, skill_id, instance_id, capability, input, triggered_by, trigger_mode, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, started_at, created_at`
	return r.db.QueryRowContext(ctx, query,
		exec.TenantID, exec.SkillID, exec.InstanceID, exec.Capability,
		exec.Input, exec.TriggeredBy, exec.TriggerMode, exec.Metadata,
	).Scan(&exec.ID, &exec.StartedAt, &exec.CreatedAt)
}

// FindExecutionByID returns an execution by ID.
func (r *Repository) FindExecutionByID(ctx context.Context, id string) (*models.SkillExecution, error) {
	var exec models.SkillExecution
	err := r.db.GetContext(ctx, &exec, `SELECT * FROM skill_executions WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &exec, nil
}

// UpdateExecution modifies an execution record.
func (r *Repository) UpdateExecution(ctx context.Context, id string, req *models.UpdateExecutionRequest) (*models.SkillExecution, error) {
	var sets []string
	var args []interface{}
	argIdx := 1

	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if req.Output != nil {
		sets = append(sets, fmt.Sprintf("output = $%d", argIdx))
		args = append(args, *req.Output)
		argIdx++
	}
	if req.ErrorMessage != nil {
		sets = append(sets, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, *req.ErrorMessage)
		argIdx++
	}
	if req.DurationMs != nil {
		sets = append(sets, fmt.Sprintf("duration_ms = $%d", argIdx))
		args = append(args, *req.DurationMs)
		argIdx++
	}
	if req.CompletedAt != nil {
		sets = append(sets, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, *req.CompletedAt)
		argIdx++
	}

	if len(sets) == 0 {
		return r.FindExecutionByID(ctx, id)
	}

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE skill_executions SET %s WHERE id = $%d RETURNING *`, strings.Join(sets, ", "), argIdx)
	var exec models.SkillExecution
	err := r.db.GetContext(ctx, &exec, query, args...)
	if err != nil {
		return nil, err
	}
	return &exec, nil
}

// FindExecutionsBySkill returns paginated executions for a skill within a tenant.
func (r *Repository) FindExecutionsBySkill(ctx context.Context, skillID, tenantID string, limit, offset int) ([]models.SkillExecution, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM skill_executions WHERE skill_id = $1 AND tenant_id = $2`, skillID, tenantID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SkillExecution
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_executions WHERE skill_id = $1 AND tenant_id = $2 ORDER BY started_at DESC LIMIT $3 OFFSET $4`,
		skillID, tenantID, limit, offset)
	return items, total, err
}

// FindExecutionsByTenant returns paginated executions for a tenant, optionally filtered by skill.
func (r *Repository) FindExecutionsByTenant(ctx context.Context, tenantID string, limit, offset int, skillID *string) ([]models.SkillExecution, int, error) {
	where := "tenant_id = $1"
	var args []interface{} = []interface{}{tenantID}
	argIdx := 2

	if skillID != nil {
		where += fmt.Sprintf(" AND skill_id = $%d", argIdx)
		args = append(args, *skillID)
		argIdx++
	}

	var total int
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM skill_executions WHERE %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`SELECT * FROM skill_executions WHERE %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	var items []models.SkillExecution
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}

// ==================== Audit Logs ====================

// CreateAuditLog inserts a new audit log entry.
func (r *Repository) CreateAuditLog(ctx context.Context, log *models.SkillAuditLog) error {
	query := `
		INSERT INTO skill_audit_logs (skill_id, action, actor_id, actor_name, old_status, new_status, reason, changes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		log.SkillID, log.Action, log.ActorID, log.ActorName,
		log.OldStatus, log.NewStatus, log.Reason, log.Changes,
	).Scan(&log.ID, &log.CreatedAt)
}

// FindAuditLogs returns paginated audit logs for a skill.
func (r *Repository) FindAuditLogs(ctx context.Context, skillID string, limit, offset int) ([]models.SkillAuditLog, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM skill_audit_logs WHERE skill_id = $1`, skillID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SkillAuditLog
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM skill_audit_logs WHERE skill_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		skillID, limit, offset)
	return items, total, err
}

// FindAllAuditLogs returns paginated audit logs across all skills, optionally filtered by action.
func (r *Repository) FindAllAuditLogs(ctx context.Context, limit, offset int, action *string) ([]models.SkillAuditLog, int, error) {
	where := ""
	var args []interface{}
	argIdx := 1

	if action != nil {
		where = fmt.Sprintf("WHERE action = $%d", argIdx)
		args = append(args, *action)
		argIdx++
	}

	var total int
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM skill_audit_logs %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`SELECT * FROM skill_audit_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	var items []models.SkillAuditLog
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}
