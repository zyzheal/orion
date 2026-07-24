package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/skill/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides data access for the skill module.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Skill CRUD ---

// CreateSkill inserts a new skill record.
func (r *Repository) CreateSkill(ctx context.Context, tenantID string, skill *models.Skill) error {
	skill.ID = uuid.New().String()
	skill.TenantID = tenantID
	skill.CreatedAt = time.Now().UTC()
	skill.UpdatedAt = time.Now().UTC()
	skill.Status = "draft"
	skill.InstallCount = 0
	skill.AvgRating = 0
	skill.RatingCount = 0

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skills (id, tenant_id, name, description, category, status, install_count, avg_rating, rating_count, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :category, :status, :install_count, :avg_rating, :rating_count, :created_at, :updated_at)`,
		skill)
	return err
}

// GetSkill retrieves a single skill by ID and tenant.
func (r *Repository) GetSkill(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	var skill models.Skill
	err := r.db.GetContext(ctx, &skill,
		`SELECT * FROM skills WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

// ListSkills returns skills for a tenant with optional category/status filtering.
func (r *Repository) ListSkills(ctx context.Context, tenantID string, category, status string) ([]models.Skill, error) {
	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if category != "" {
		where.WriteString(fmt.Sprintf(" AND category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}
	if status != "" {
		where.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	var skills []models.Skill
	err := r.db.SelectContext(ctx, &skills,
		fmt.Sprintf(`SELECT * FROM skills %s ORDER BY created_at DESC`, where.String()),
		args...)
	return skills, err
}

// UpdateSkill applies partial updates to a skill by ID.
func (r *Repository) UpdateSkill(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return sentinel.NotFound
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

	query := fmt.Sprintf(`UPDATE skills SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// DeleteSkill soft-deletes a skill by setting status to "archived".
func (r *Repository) DeleteSkill(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE skills SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		"archived", time.Now().UTC(), id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// GetStats returns aggregated skill counts for a tenant.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	result := make(map[string]any)

	// Total skills
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM skills WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	result["total_skills"] = total

	// Total installs
	var totalInstalls int
	err = r.db.GetContext(ctx, &totalInstalls,
		`SELECT COALESCE(SUM(install_count), 0) FROM skills WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	result["total_installs"] = totalInstalls

	// By status
	byStatus := make(map[string]int)
	var statusRows []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	err = r.db.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) as count FROM skills WHERE tenant_id=$1 GROUP BY status ORDER BY status`,
		tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		byStatus[row.Status] = row.Count
	}
	result["by_status"] = byStatus

	// By category
	byCategory := make(map[string]int)
	var categoryRows []struct {
		Category string `db:"category"`
		Count    int    `db:"count"`
	}
	err = r.db.SelectContext(ctx, &categoryRows,
		`SELECT category, COUNT(*) as count FROM skills WHERE tenant_id=$1 GROUP BY category ORDER BY category`,
		tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range categoryRows {
		byCategory[row.Category] = row.Count
	}
	result["by_category"] = byCategory

	return &result, nil
}

// --- Versions ---

// ListVersions returns all versions for a skill.
func (r *Repository) ListVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	var versions []models.SkillVersion
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM skill_versions WHERE skill_id=$1 ORDER BY created_at DESC`, skillID)
	return versions, err
}

// CreateVersion inserts a new version record.
func (r *Repository) CreateVersion(ctx context.Context, v *models.SkillVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skill_versions (id, skill_id, version, changes, created_at)
		 VALUES (:id, :skill_id, :version, :changes, :created_at)`,
		v)
	return err
}

// VersionExists checks if a version already exists for a skill.
func (r *Repository) VersionExists(ctx context.Context, skillID, version string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM skill_versions WHERE skill_id=$1 AND version=$2`, skillID, version)
	return count > 0, err
}

// --- Ratings ---

// RateSkill records a rating for a skill and recalculates avg.
func (r *Repository) RateSkill(ctx context.Context, skillID string, rating int) error {
	// Insert rating
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO skill_ratings (skill_id, rating, created_at) VALUES ($1, $2, $3)`,
		skillID, rating, time.Now().UTC())
	if err != nil {
		return err
	}

	// Recalculate avg
	now := time.Now().UTC()
	_, err = r.db.ExecContext(ctx,
		`UPDATE skills SET avg_rating=$1, rating_count=$2, updated_at=$3
		 WHERE id=$4
		 RETURNING id`,
		0, 0, now, skillID) // placeholders replaced by subquery below

	// Use a proper UPDATE with subquery
	_, err = r.db.ExecContext(ctx,
		`UPDATE skills SET
			 avg_rating = (SELECT AVG(rating)::float FROM skill_ratings WHERE skill_id = $1),
			 rating_count = (SELECT COUNT(*) FROM skill_ratings WHERE skill_id = $1),
			 updated_at = $2
		 WHERE id = $1`,
		skillID, now)
	return err
}

// GetRatingStats returns rating distribution for a skill.
func (r *Repository) GetRatingStats(ctx context.Context, skillID string) (*map[string]any, error) {
	stats := make(map[string]any)

	var avgRating float64
	var ratingCount int
	err := r.db.GetContext(ctx, &avgRating,
		`SELECT COALESCE(AVG(rating)::float, 0) FROM skill_ratings WHERE skill_id=$1`, skillID)
	if err != nil {
		return nil, err
	}
	stats["avg_rating"] = avgRating

	err = r.db.GetContext(ctx, &ratingCount,
		`SELECT COUNT(*) FROM skill_ratings WHERE skill_id=$1`, skillID)
	if err != nil {
		return nil, err
	}
	stats["rating_count"] = ratingCount

	// Distribution
	distribution := make(map[string]int)
	var rows []struct {
		Rating  int `db:"rating"`
		Count   int `db:"count"`
	}
	err = r.db.SelectContext(ctx, &rows,
		`SELECT rating, COUNT(*) as count FROM skill_ratings WHERE skill_id=$1 GROUP BY rating ORDER BY rating`,
		skillID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		distribution[fmt.Sprintf("%d", row.Rating)] = row.Count
	}
	stats["distribution"] = distribution

	return &stats, nil
}

// --- Instances ---

// ListInstances returns all instances for a tenant.
func (r *Repository) ListInstances(ctx context.Context, tenantID string) ([]models.SkillInstance, error) {
	var instances []models.SkillInstance
	err := r.db.SelectContext(ctx, &instances,
		`SELECT * FROM skill_instances WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return instances, err
}

// GetInstance retrieves a single instance by ID and tenant.
func (r *Repository) GetInstance(ctx context.Context, tenantID, id string) (*models.SkillInstance, error) {
	var inst models.SkillInstance
	err := r.db.GetContext(ctx, &inst,
		`SELECT * FROM skill_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// CreateInstance inserts a new skill instance.
func (r *Repository) CreateInstance(ctx context.Context, inst *models.SkillInstance) error {
	inst.ID = uuid.New().String()
	inst.CreatedAt = time.Now().UTC()
	inst.UpdatedAt = time.Now().UTC()
	inst.Status = "active"

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skill_instances (id, skill_id, tenant_id, instance_name, config, status, created_at, updated_at)
		 VALUES (:id, :skill_id, :tenant_id, :instance_name, :config, :status, :created_at, :updated_at)`,
		inst)
	return err
}

// UpdateInstance applies partial updates to an instance.
func (r *Repository) UpdateInstance(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return sentinel.NotFound
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

	query := fmt.Sprintf(`UPDATE skill_instances SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// DeleteInstance removes an instance by ID and tenant.
func (r *Repository) DeleteInstance(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM skill_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// UpdateInstallCount adjusts the install count for a skill by delta.
func (r *Repository) UpdateInstallCount(ctx context.Context, skillID string, delta int) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE skills SET install_count = install_count + $1, updated_at = $2 WHERE id = $3`,
		delta, now, skillID)
	return err
}

// --- Executions ---

// CreateExecution inserts a new execution record.
func (r *Repository) CreateExecution(ctx context.Context, exec *models.SkillExecution) error {
	exec.ID = uuid.New().String()
	exec.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skill_executions (id, skill_id, tenant_id, user_id, input, output, status, duration_ms, created_at)
		 VALUES (:id, :skill_id, :tenant_id, :user_id, :input, :output, :status, :duration_ms, :created_at)`,
		exec)
	return err
}

// ListExecutions returns executions for a tenant, optionally filtered by skill.
func (r *Repository) ListExecutions(ctx context.Context, tenantID, skillID string) ([]models.SkillExecution, error) {
	query := `SELECT * FROM skill_executions WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if skillID != "" {
		query += ` AND skill_id=$2`
		args = append(args, skillID)
	}
	query += ` ORDER BY created_at DESC`

	var executions []models.SkillExecution
	err := r.db.SelectContext(ctx, &executions, query, args...)
	return executions, err
}

// --- Reviews ---

// GetReview retrieves the review for a skill.
func (r *Repository) GetReview(ctx context.Context, skillID string) (*models.SkillReview, error) {
	var review models.SkillReview
	err := r.db.GetContext(ctx, &review,
		`SELECT * FROM skill_reviews WHERE skill_id=$1`, skillID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &review, nil
}

// CreateReview inserts a new review record.
func (r *Repository) CreateReview(ctx context.Context, review *models.SkillReview) error {
	review.ID = uuid.New().String()
	review.CreatedAt = time.Now().UTC()
	review.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skill_reviews (id, skill_id, tenant_id, status, submitted_by, reviewed_by, review_note, created_at, updated_at)
		 VALUES (:id, :skill_id, :tenant_id, :status, :submitted_by, :reviewed_by, :review_note, :created_at, :updated_at)`,
		review)
	return err
}

// UpdateReview applies partial updates to a review.
func (r *Repository) UpdateReview(ctx context.Context, tenantID, skillID string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return sentinel.NotFound
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
	args = append(args, skillID)

	query := fmt.Sprintf(`UPDATE skill_reviews SET %s WHERE skill_id=$%d`,
		strings.Join(setClauses, ", "), i)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// ListReviews returns reviews for a tenant with optional status filtering.
func (r *Repository) ListReviews(ctx context.Context, tenantID string, status string) ([]models.SkillReview, error) {
	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if status != "" {
		where.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		_ = argIdx
		args = append(args, status)
		argIdx++
	}

	var reviews []models.SkillReview
	err := r.db.SelectContext(ctx, &reviews,
		fmt.Sprintf(`SELECT * FROM skill_reviews %s ORDER BY created_at DESC`, where.String()),
		args...)
	return reviews, err
}

// --- Audit logs ---

// CreateAuditLog inserts a new audit log entry.
func (r *Repository) CreateAuditLog(ctx context.Context, log *models.SkillAuditLog) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO skill_audit_logs (skill_id, tenant_id, action, user_id, details, created_at)
		 VALUES (:skill_id, :tenant_id, :action, :user_id, :details, :created_at)`,
		log)
	return err
}

// ListAuditLogs returns audit logs for a tenant, optionally filtered by skill.
func (r *Repository) ListAuditLogs(ctx context.Context, tenantID, skillID string) ([]models.SkillAuditLog, error) {
	query := `SELECT * FROM skill_audit_logs WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if skillID != "" {
		query += ` AND skill_id=$2`
		args = append(args, skillID)
	}
	query += ` ORDER BY created_at DESC`

	var logs []models.SkillAuditLog
	err := r.db.SelectContext(ctx, &logs, query, args...)
	return logs, err
}
