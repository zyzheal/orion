package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/models/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrDuplicate = errors.New("duplicate record")
)

// Repository handles PostgreSQL persistence for AI models.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// unixNow returns current unix seconds.
func unixNow() int64 {
	return time.Now().UTC().Unix()
}

// nullString returns the pointer as-is (sqlx handles NULL).
func nullString(s *string) *string {
	return s
}

// nullInt64 returns the pointer as-is (sqlx handles NULL).
func nullInt64(i *int64) *int64 {
	return i
}

// --- AIModel ---

func (r *Repository) CreateModel(ctx context.Context, m *models.AIModel) error {
	m.ID = uuid.New().String()
	now := unixNow()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Tags == "" {
		m.Tags = "[]"
	}
	if m.Metadata == "" {
		m.Metadata = "{}"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_models (id, name, display_name, description, type, status, framework,
			current_version, tags, metadata, created_by, tenant_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		m.ID, m.Name, m.DisplayName, m.Description, string(m.Type), string(m.Status), m.Framework,
		nullString(m.CurrentVersion), m.Tags, m.Metadata, m.CreatedBy, m.TenantID, now, now,
	)
	return err
}

func (r *Repository) GetModel(ctx context.Context, tenantID, modelID string) (*models.AIModel, error) {
	var m models.AIModel
	err := r.db.GetContext(ctx, &m,
		`SELECT id, name, display_name, description, type, status, framework, current_version,
			tags, metadata, created_by, tenant_id, created_at, updated_at
		 FROM ai_models WHERE id=$1 AND tenant_id=$2`, modelID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateModel(ctx context.Context, tenantID, modelID string, displayName *string, description *string, tagsJSON, metadataJSON string) (*models.AIModel, error) {
	updated := unixNow()
	var query string
	var args []interface{}
	if displayName != nil && description != nil {
		query = `UPDATE ai_models SET display_name=$1, description=$2, tags=$3, metadata=$4, updated_at=$5 WHERE id=$6 AND tenant_id=$7`
		args = []interface{}{*displayName, *description, tagsJSON, metadataJSON, updated, modelID, tenantID}
	} else if displayName != nil {
		query = `UPDATE ai_models SET display_name=$1, tags=$2, metadata=$3, updated_at=$4 WHERE id=$5 AND tenant_id=$6`
		args = []interface{}{*displayName, tagsJSON, metadataJSON, updated, modelID, tenantID}
	} else {
		query = `UPDATE ai_models SET tags=$1, metadata=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`
		args = []interface{}{tagsJSON, metadataJSON, updated, modelID, tenantID}
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetModel(ctx, tenantID, modelID)
}

func (r *Repository) DeleteModel(ctx context.Context, tenantID, modelID string) error {
	// Delete canary config
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_canary_configs WHERE model_id=$1 AND tenant_id=$2`, modelID, tenantID)
	if err != nil {
		return err
	}
	// Delete versions
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM ai_model_versions WHERE model_id=$1 AND tenant_id=$2`, modelID, tenantID)
	if err != nil {
		return err
	}
	// Delete model
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM ai_models WHERE id=$1 AND tenant_id=$2`, modelID, tenantID)
	return err
}

func (r *Repository) ListModels(ctx context.Context, tenantID string, q models.ListModelsQuery) ([]models.AIModel, int, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Sort == "" {
		q.Sort = "created_at"
	}
	if q.Order == "" {
		q.Order = "desc"
	}

	var where []string
	var args []interface{}
	argIdx := 1

	where = append(where, fmt.Sprintf("tenant_id=$%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if q.Type != "" {
		where = append(where, fmt.Sprintf("type=$%d", argIdx))
		args = append(args, q.Type)
		argIdx++
	}
	if q.Status != "" {
		where = append(where, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}
	if q.Tags != "" {
		// Check JSONB array contains any of the tags
		where = append(where, fmt.Sprintf("tags::jsonb ? $%d OR tags::text LIKE $%d", argIdx, argIdx))
		// Simplified: match any tag in the JSON array
		where[len(where)-1] = fmt.Sprintf("(tags::text LIKE $%d)", argIdx)
		args = append(args, "%\""+q.Tags+"\"%")
		argIdx++
	}
	if q.Search != "" {
		where = append(where, fmt.Sprintf("(name ILIKE $%d OR display_name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	}

	whereClause := "WHERE " + joinWhere(where)

	// Count
	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf("SELECT COUNT(*) FROM ai_models %s", whereClause), args...)
	if err != nil {
		return nil, 0, err
	}

	// List
	orderDir := "DESC"
	if q.Order == "asc" {
		orderDir = "ASC"
	}
	query := fmt.Sprintf(`SELECT id, name, display_name, description, type, status, framework, current_version,
		tags, metadata, created_by, tenant_id, created_at, updated_at
		FROM ai_models %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		whereClause, q.Sort, orderDir, argIdx, argIdx+1)
	args = append(args, q.Limit, q.Offset)

	models := make([]models.AIModel, 0)
	err = r.db.SelectContext(ctx, &models, query, args...)
	return models, total, err
}

// ModelExists checks if a model name exists for a tenant.
func (r *Repository) ModelExists(ctx context.Context, tenantID, name string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM ai_models WHERE name=$1 AND tenant_id=$2)`, name, tenantID)
	return exists, err
}

// --- ModelVersion ---

func (r *Repository) CreateVersion(ctx context.Context, v *models.ModelVersion) error {
	v.ID = uuid.New().String()
	now := unixNow()
	v.CreatedAt = now
	if v.Metrics == "" {
		v.Metrics = "{}"
	}
	if v.Config == "" {
		v.Config = "{}"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_model_versions (id, model_id, version, artifact_uri, environment, status,
			metrics, config, created_by, tenant_id, created_at, promoted_at, promoted_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		v.ID, v.ModelID, v.Version, v.ArtifactUri, string(v.Environment), string(v.Status),
		v.Metrics, v.Config, v.CreatedBy, v.TenantID, now, nullInt64(v.PromotedAt), nullString(v.PromotedBy),
	)
	return err
}

func (r *Repository) GetVersion(ctx context.Context, tenantID, modelID, versionID string) (*models.ModelVersion, error) {
	var v models.ModelVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT id, model_id, version, artifact_uri, environment, status, metrics, config,
			created_by, tenant_id, created_at, promoted_at, promoted_by, deprecated_at
		 FROM ai_model_versions WHERE id=$1 AND model_id=$2 AND tenant_id=$3`, versionID, modelID, tenantID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *Repository) ListVersions(ctx context.Context, tenantID, modelID string, q models.ListVersionsQuery) ([]models.ModelVersion, int, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}

	var where []string
	var args []interface{}
	argIdx := 1

	where = append(where, fmt.Sprintf("tenant_id=$%d", argIdx))
	args = append(args, tenantID)
	argIdx++
	where = append(where, fmt.Sprintf("model_id=$%d", argIdx))
	args = append(args, modelID)
	argIdx++

	if q.Environment != "" {
		where = append(where, fmt.Sprintf("environment=$%d", argIdx))
		args = append(args, q.Environment)
		argIdx++
	}

	whereClause := "WHERE " + joinWhere(where)

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf("SELECT COUNT(*) FROM ai_model_versions %s", whereClause), args...)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT id, model_id, version, artifact_uri, environment, status, metrics, config,
		created_by, tenant_id, created_at, promoted_at, promoted_by, deprecated_at
		FROM ai_model_versions %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, q.Limit, q.Offset)

	versions := make([]models.ModelVersion, 0)
	err = r.db.SelectContext(ctx, &versions, query, args...)
	return versions, total, err
}

func (r *Repository) UpdateVersion(ctx context.Context, tenantID, versionID string, environment models.Environment, status models.ModelStatus, promotedAt *int64, promotedBy *string) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_model_versions SET environment=$1, status=$2, promoted_at=$3, promoted_by=$4, updated_at=$5
		 WHERE id=$6 AND tenant_id=$7`,
		string(environment), string(status), nullInt64(promotedAt), nullString(promotedBy), updated, versionID, tenantID)
	return err
}

func (r *Repository) UpdateVersionDeprecated(ctx context.Context, tenantID, versionID string, deprecatedAt *int64) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_model_versions SET status=$1, deprecated_at=$2, updated_at=$3
		 WHERE id=$4 AND tenant_id=$5`,
		string(models.ModelStatusDeprecated), nullInt64(deprecatedAt), updated, versionID, tenantID)
	return err
}

func (r *Repository) GetVersionsByModel(ctx context.Context, tenantID, modelID string) ([]models.ModelVersion, error) {
	versions := make([]models.ModelVersion, 0)
	err := r.db.SelectContext(ctx, &versions,
		`SELECT id, model_id, version, artifact_uri, environment, status, metrics, config,
			created_by, tenant_id, created_at, promoted_at, promoted_by, deprecated_at
			FROM ai_model_versions WHERE model_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, modelID, tenantID)
	return versions, err
}

// GetProductionVersions returns all production versions for a model.
func (r *Repository) GetProductionVersions(ctx context.Context, tenantID, modelID string) ([]models.ModelVersion, error) {
	versions := make([]models.ModelVersion, 0)
	err := r.db.SelectContext(ctx, &versions,
		`SELECT id, model_id, version, artifact_uri, environment, status, metrics, config,
			created_by, tenant_id, created_at, promoted_at, promoted_by, deprecated_at
			FROM ai_model_versions WHERE model_id=$1 AND tenant_id=$2 AND status=$3 AND environment=$4
			ORDER BY created_at DESC`, modelID, tenantID, string(models.ModelStatusProduction), string(models.EnvProduction))
	return versions, err
}

// CountVersions returns the version count for a model.
func (r *Repository) CountVersions(ctx context.Context, tenantID, modelID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ai_model_versions WHERE model_id=$1 AND tenant_id=$2`, modelID, tenantID)
	return count, err
}

// UpdateModelCurrentVersion sets the current version and status on a model.
func (r *Repository) UpdateModelCurrentVersion(ctx context.Context, tenantID, modelID, version string, status models.ModelStatus) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_models SET current_version=$1, status=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`,
		version, string(status), updated, modelID, tenantID)
	return err
}

// --- CanaryConfig ---

func (r *Repository) CreateCanary(ctx context.Context, c *models.CanaryConfig) error {
	c.ID = uuid.New().String()
	now := unixNow()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_canary_configs (id, model_id, enabled, target_version, traffic_percent,
			success_threshold, latency_threshold, error_rate_threshold, start_time, duration,
			status, current_metrics, tenant_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		c.ID, c.ModelID, c.Enabled, c.TargetVersion, c.TrafficPercent,
		c.SuccessThreshold, c.LatencyThreshold, c.ErrorRateThreshold,
		c.StartTime, c.Duration, string(c.Status), nullString(c.CurrentMetrics),
		c.TenantID, now, now,
	)
	return err
}

func (r *Repository) GetCanary(ctx context.Context, tenantID, modelID string) (*models.CanaryConfig, error) {
	var c models.CanaryConfig
	err := r.db.GetContext(ctx, &c,
		`SELECT id, model_id, enabled, target_version, traffic_percent, success_threshold,
			latency_threshold, error_rate_threshold, start_time, duration, status, current_metrics,
			tenant_id, created_at, updated_at
		 FROM ai_canary_configs WHERE model_id=$1 AND tenant_id=$2`, modelID, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) UpdateCanary(ctx context.Context, tenantID, modelID string, enabled bool, status models.CanaryStatus) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_canary_configs SET enabled=$1, status=$2, updated_at=$3
		 WHERE model_id=$4 AND tenant_id=$5`,
		enabled, string(status), updated, modelID, tenantID)
	return err
}

// --- helpers ---

func joinWhere(where []string) string {
	result := ""
	for i, w := range where {
		if i > 0 {
			_ = i // keep for readability
			result += " AND "
		}
		result += w
	}
	return result
}
