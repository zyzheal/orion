package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-build-env-svc-go/internal/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateBuilderImage creates a new builder image
func (r *Repository) CreateBuilderImage(ctx context.Context, tenantID string, img *models.BuilderImage) (*models.BuilderImage, error) {
	img.ID = uuid.New().String()
	img.TenantID = tenantID
	img.CreatedAt = time.Now().UTC()
	img.UpdatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO builder_image (id, tenant_id, name, registry, tag, base_image, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :registry, :tag, :base_image, :status, :created_at, :updated_at)`,
		img)
	if err != nil {
		return nil, fmt.Errorf("failed to create builder image: %w", err)
	}
	return img, nil
}

// ListBuilderImages lists all builder images for a tenant
func (r *Repository) ListBuilderImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuilderImage, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.BuilderImage
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, registry, tag, base_image, status, created_at, updated_at
		 FROM builder_image WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetBuilderImage gets a builder image by ID
func (r *Repository) GetBuilderImage(ctx context.Context, tenantID, id string) (*models.BuilderImage, error) {
	var img models.BuilderImage
	err := r.db.GetContext(ctx, &img,
		`SELECT id, tenant_id, name, registry, tag, base_image, status, created_at, updated_at
		 FROM builder_image WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &img, nil
}

// UpdateBuilderImage updates a builder image
func (r *Repository) UpdateBuilderImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	args := make([]interface{}, 0, len(updates)+2)
	setClauses := make([]string, 0, len(updates))
	for i, k := range getKeys(updates) {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i+1))
		args = append(args, updates[k])
	}
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE builder_image SET %s WHERE id = $%d AND tenant_id = $%d`,
			joinStrings(setClauses, ", "), len(setClauses)+1, len(setClauses)+2),
		args...)
	if err != nil {
		return fmt.Errorf("failed to update builder image: %w", err)
	}
	return nil
}

// DeleteBuilderImage deletes a builder image
func (r *Repository) DeleteBuilderImage(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM builder_image WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete builder image: %w", err)
	}
	return nil
}

// CreateBuild creates a new build
func (r *Repository) CreateBuild(ctx context.Context, tenantID string, build *models.Build) error {
	build.ID = uuid.New().String()
	build.TenantID = tenantID
	build.CreatedAt = time.Now().UTC()
	build.UpdatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO build (id, tenant_id, pipeline_id, status, started_at, finished_at, metadata, created_at, updated_at)
		 VALUES (:id, :tenant_id, :pipeline_id, :status, :started_at, :finished_at, :metadata, :created_at, :updated_at)`,
		build)
	if err != nil {
		return fmt.Errorf("failed to create build: %w", err)
	}
	return nil
}

// ListBuilds lists builds for a tenant
func (r *Repository) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Build
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, pipeline_id, status, started_at, finished_at, metadata, created_at, updated_at
		 FROM build WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetBuild gets a build by ID
func (r *Repository) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var build models.Build
	err := r.db.GetContext(ctx, &build,
		`SELECT id, tenant_id, pipeline_id, status, started_at, finished_at, metadata, created_at, updated_at
		 FROM build WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &build, nil
}

// UpdateBuild updates a build
func (r *Repository) UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	args := make([]interface{}, 0, len(updates)+2)
	setClauses := make([]string, 0, len(updates))
	for i, k := range getKeys(updates) {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i+1))
		args = append(args, updates[k])
	}
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE build SET %s WHERE id = $%d AND tenant_id = $%d`,
			joinStrings(setClauses, ", "), len(setClauses)+1, len(setClauses)+2),
		args...)
	if err != nil {
		return fmt.Errorf("failed to update build: %w", err)
	}
	return nil
}

// DeleteBuild deletes a build
func (r *Repository) DeleteBuild(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM build WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete build: %w", err)
	}
	return nil
}

func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func joinStrings(strings []string, sep string) string {
	if len(strings) == 0 {
		return ""
	}
	result := strings[0]
	for _, s := range strings[1:] {
		result += sep + s
	}
	return result
}
