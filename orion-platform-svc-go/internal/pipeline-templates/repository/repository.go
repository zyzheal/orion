package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-templates/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("template not found")

// Repository provides PostgreSQL CRUD for pipeline templates.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// nowUnix returns the current unix timestamp in seconds.
func nowUnix() *int64 {
	t := time.Now().Unix()
	return &t
}

// --- Template CRUD ---

func (r *Repository) Create(ctx context.Context, m *models.PipelineTemplate) error {
	m.ID = uuid.New().String()
	ts := nowUnix()
	m.CreatedAt = ts
	m.UpdatedAt = ts
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO pipeline_templates (
			id, tenant_id, name, display_name, description, category, tags, status, visibility,
			version, author, organization, config, parameters, readme, icon,
			usage_count, star_count, created_at, updated_at
		) VALUES (
			:id, :tenant_id, :name, :display_name, :description, :category, :tags, :status, :visibility,
			:version, :author, :organization, :config, :parameters, :readme, :icon,
			:usage_count, :star_count, :created_at, :updated_at
		)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	var m models.PipelineTemplate
	err := r.db.GetContext(ctx, &m,
		"SELECT * FROM pipeline_templates WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

// List returns paginated templates for a tenant, applying optional filters.
func (r *Repository) List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	// Build WHERE clause and arguments
	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if q.Category != "" {
		whereParts = append(whereParts, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, q.Category)
		argIdx++
	}
	if q.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}
	if q.Visibility != "" {
		whereParts = append(whereParts, fmt.Sprintf("visibility = $%d", argIdx))
		args = append(args, q.Visibility)
		argIdx++
	}
	if q.Author != "" {
		whereParts = append(whereParts, fmt.Sprintf("author = $%d", argIdx))
		args = append(args, q.Author)
		argIdx++
	}
	if q.Tags != "" {
		// tags stored as JSONB array; use contains overlap
		whereParts = append(whereParts, fmt.Sprintf("tags && $%d::jsonb", argIdx))
		args = append(args, q.Tags)
		argIdx++
	}
	if q.Search != "" {
		whereParts = append(whereParts, fmt.Sprintf("(LOWER(name) LIKE $%d OR LOWER(display_name) LIKE $%d OR LOWER(description) LIKE $%d)", argIdx, argIdx+1, argIdx+2))
		searchPct := "%" + strings.ToLower(q.Search) + "%"
		args = append(args, searchPct, searchPct, searchPct)
		argIdx += 3
	}

	whereClause := strings.Join(whereParts, " AND ")
	sortField := "created_at"
	if q.Sort != "" {
		sortField = q.Sort
	}
	sortOrder := "DESC"
	if q.Order != "" && strings.ToLower(q.Order) == "asc" {
		sortOrder = "ASC"
	}

	// Count query
	countSQL := "SELECT COUNT(*) FROM pipeline_templates WHERE " + whereClause
	var total int
	if err := r.db.GetContext(ctx, &total, countSQL, args...); err != nil {
		return nil, 0, err
	}

	// Data query
	dataSQL := fmt.Sprintf("SELECT * FROM pipeline_templates WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		whereClause, sortField, sortOrder, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var items []models.PipelineTemplate
	err := r.db.SelectContext(ctx, &items, dataSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.PipelineTemplate, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	ts := nowUnix()
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", idx))
	args = append(args, *ts)
	idx++
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		"UPDATE pipeline_templates SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	// Delete associated versions first
	_, _ = r.db.ExecContext(ctx, "DELETE FROM template_versions WHERE template_id = $1", id)
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM pipeline_templates WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}

// IncrementUsageCount atomically bumps usage_count.
func (r *Repository) IncrementUsageCount(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE pipeline_templates SET usage_count = usage_count + 1, updated_at = $1 WHERE id = $2 AND tenant_id = $3",
		nowUnix(), id, tenantID)
	return err
}

// IncrementStarCount atomically bumps star_count.
func (r *Repository) IncrementStarCount(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE pipeline_templates SET star_count = star_count + 1, updated_at = $1 WHERE id = $2 AND tenant_id = $3",
		nowUnix(), id, tenantID)
	return err
}

// DecrementStarCount atomically decrements star_count (floor at 0).
func (r *Repository) DecrementStarCount(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE pipeline_templates SET star_count = GREATEST(star_count - 1, 0), updated_at = $1 WHERE id = $2 AND tenant_id = $3",
		nowUnix(), id, tenantID)
	return err
}

// SetStatus updates the template status.
func (r *Repository) SetStatus(ctx context.Context, tenantID, id string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error) {
	args := []interface{}{status, nowUnix(), publishedAt, id, tenantID}
	_, err := r.db.ExecContext(ctx,
		"UPDATE pipeline_templates SET status = $1, updated_at = $2, published_at = $3 WHERE id = $4 AND tenant_id = $5",
		args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// --- Version CRUD ---

func (r *Repository) CreateVersion(ctx context.Context, v *models.TemplateVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = nowUnix()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO template_versions (
			id, template_id, version, config, parameters, change_log, created_at, created_by
		) VALUES (
			:id, :template_id, :version, :config, :parameters, :change_log, :created_at, :created_by
		)`, v)
	return err
}

func (r *Repository) ListVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	// Verify template belongs to tenant
	var total int
	err := r.db.GetContext(ctx, &total,
		"SELECT COUNT(*) FROM template_versions v JOIN pipeline_templates t ON v.template_id = t.id WHERE v.template_id = $1 AND t.tenant_id = $2",
		templateID, tenantID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.TemplateVersion
	err = r.db.SelectContext(ctx, &items,
		"SELECT * FROM template_versions v JOIN pipeline_templates t ON v.template_id = t.id WHERE v.template_id = $1 AND t.tenant_id = $2 ORDER BY v.created_at DESC LIMIT $3 OFFSET $4",
		templateID, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// DeleteVersionsByTemplateID deletes all versions for a template.
func (r *Repository) DeleteVersionsByTemplateID(ctx context.Context, templateID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM template_versions WHERE template_id = $1", templateID)
	return err
}

// --- Categories ---

// CategoryCounts returns the count of templates per category for a tenant.
func (r *Repository) CategoryCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	var rows []struct {
		Category string `db:"category"`
		Count    int    `db:"count"`
	}
	err := r.db.SelectContext(ctx, &rows,
		"SELECT category, COUNT(*) AS count FROM pipeline_templates WHERE tenant_id = $1 GROUP BY category", tenantID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]int)
	for _, r := range rows {
		result[r.Category] = r.Count
	}
	return result, nil
}

// marshalJSON converts an interface{} to a JSON string or empty string.
func marshalJSON(v interface{}) string {
	if v == nil {
		return ""
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}
