package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-versions/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("pipeline version not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateVersion inserts a new version record.
func (r *Repository) CreateVersion(ctx context.Context, v *models.Version) error {
	v.ID = uuid.New().String()
	now := time.Now().UTC()
	v.CreatedAt = now
	v.UpdatedAt = now

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_versions
			(id, tenant_id, pipeline_id, version, name, description, config, status, is_default,
			 created_by, created_at, updated_at, change_log, tags, parent_version_id)
		 VALUES
			(:id, :tenantId, :pipelineId, :version, :name, :description, :config, :status, :isDefault,
			 :createdBy, :createdAt, :updatedAt, :changeLog, :tags, :parentVersionId)`,
		v)
	return err
}

// GetVersion retrieves a version by ID within a tenant.
func (r *Repository) GetVersion(ctx context.Context, tenantID, id string) (*models.Version, error) {
	var v models.Version
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM pipeline_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &v, err
}

// ListVersions returns versions for a pipeline with optional filtering and pagination.
func (r *Repository) ListVersions(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error) {
	where, args := buildListWhere(tenantID, pipelineID, q, false)

	// Count
	var total int
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM pipeline_versions %s`, where), args...)
	if err != nil {
		return nil, err
	}

	// Rows
	var versions []models.Version
	sortClause := buildSortClause(q)
	lim := fmt.Sprintf(" ORDER BY %s LIMIT $%d OFFSET $%d", sortClause, len(args)+1, len(args)+2)
	args = append(args, q.Limit, q.Offset)

	err = r.db.SelectContext(ctx, &versions,
		fmt.Sprintf(`SELECT * FROM pipeline_versions %s%s`, where, lim), args...)
	if err != nil {
		return nil, err
	}
	return &models.VersionListResult{Data: versions, Total: total}, nil
}

// UpdateVersion applies partial updates to a version.
func (r *Repository) UpdateVersion(ctx context.Context, tenantID, id string, updates map[string]any) (*models.Version, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	clauses, args, i := buildUpdateClauses(updates)
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE pipeline_versions SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(clauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetVersion(ctx, tenantID, id)
}

// SetIsDefault clears is_default for other versions of the same pipeline.
func (r *Repository) ClearDefaultForPipeline(ctx context.Context, tenantID, pipelineID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET is_default=$1 WHERE pipeline_id=$2 AND tenant_id=$3`,
		false, pipelineID, tenantID)
	return err
}

// SetStatusPublished marks a version as published and records the published timestamp.
func (r *Repository) SetStatusPublished(ctx context.Context, tenantID, id string, publishedAt time.Time, isDefault bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET status=$1, published_at=$2, is_default=$3, updated_at=$4
		 WHERE id=$5 AND tenant_id=$6`,
		string(models.StatusPublished), publishedAt, isDefault, time.Now().UTC(), id, tenantID)
	return err
}

// SetStatusDeprecated marks a version as deprecated with a deprecated timestamp.
func (r *Repository) SetStatusDeprecated(ctx context.Context, tenantID, id string) error {
	deprecatedAt := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET status=$1, deprecated_at=$2, updated_at=$3
		 WHERE id=$4 AND tenant_id=$5`,
		string(models.StatusDeprecated), deprecatedAt, time.Now().UTC(), id, tenantID)
	return err
}

// ListPublishedVersions returns published versions for a pipeline sorted by published_at descending.
func (r *Repository) ListPublishedVersions(ctx context.Context, tenantID, pipelineID string) ([]models.Version, error) {
	var versions []models.Version
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM pipeline_versions
		 WHERE pipeline_id=$1 AND tenant_id=$2 AND status=$3
		 ORDER BY published_at DESC`,
		pipelineID, tenantID, string(models.StatusPublished))
	return versions, err
}

// DeleteVersion removes a version record.
func (r *Repository) DeleteVersion(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Internal helpers ---

func buildListWhere(tenantID, pipelineID string, q *models.ListQuery, forCount bool) (string, []any) {
	where := "WHERE tenant_id=$1 AND pipeline_id=$2"
	args := []any{tenantID, pipelineID}
	i := 3

	if q != nil && q.Status != nil && *q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", i)
		args = append(args, string(*q.Status))
		i++
	}

	if q != nil && q.Tags != nil && *q.Tags != "" {
		// Tags stored as JSON array; check if any tag matches via jsonb query
		where += fmt.Sprintf(" AND tags ? $%d", i)
		args = append(args, *q.Tags)
		i++
	}

	return where, args
}

func buildSortClause(q *models.ListQuery) string {
	sort := "created_at"
	order := "DESC"
	if q != nil && q.Sort != "" {
		sort = q.Sort
	}
	if q != nil && q.Order != "" {
		order = q.Order
	}
	return fmt.Sprintf("%s %s", sort, order)
}

func buildUpdateClauses(updates map[string]any) ([]string, []any, int) {
	clauses := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates))
	i := 1
	for k, v := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}
	// Always refresh updated_at
	clauses = append(clauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now().UTC())
	return clauses, args, i + 1
}
