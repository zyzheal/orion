package repository

import (
	"context"
	"database/sql"
	"fmt"

	"orion/build-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// BuilderImageRepository handles database operations for builder images.
type BuilderImageRepository struct {
	db *database.DB
}

func NewBuilderImageRepository(db *database.DB) *BuilderImageRepository {
	return &BuilderImageRepository{db: db}
}

func (r *BuilderImageRepository) scan(ctx context.Context, query string, args ...interface{}) (*models.BuilderImage, error) {
	var img models.BuilderImage
	err := r.db.GetContext(ctx, &img, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("builder image query failed: %w", err)
	}
	return &img, nil
}

// Create inserts a new builder image.
func (r *BuilderImageRepository) Create(ctx context.Context, img *models.BuilderImage) error {
	env := img.Env
	labels := img.Labels
	query := `INSERT INTO builder_images (name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		img.Name, img.DisplayName, img.Image, img.Type, img.Version, img.Description,
		img.PullPolicy, img.Status, img.IsPreset, env, labels, img.CreatedBy,
	).Scan(&img.ID, &img.CreatedAt)
}

// GetByID retrieves an image by ID.
func (r *BuilderImageRepository) GetByID(ctx context.Context, id string) (*models.BuilderImage, error) {
	return r.scan(ctx, `SELECT id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images WHERE id = $1`, id)
}

// FindByName looks up an image by its name.
func (r *BuilderImageRepository) FindByName(ctx context.Context, name string) (*models.BuilderImage, error) {
	return r.scan(ctx, `SELECT id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images WHERE name = $1`, name)
}

// ListAll returns all images ordered by creation date.
func (r *BuilderImageRepository) ListAll(ctx context.Context, offset, limit int) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	limit = limitOrDefault(limit, 100)
	query := `SELECT id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	err := r.db.SelectContext(ctx, &imgs, query, limit, offset)
	return imgs, err
}

// ListByIsPreset filters images by the is_preset flag.
func (r *BuilderImageRepository) ListByIsPreset(ctx context.Context, isPreset bool) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	err := r.db.SelectContext(ctx, &imgs,
		`SELECT id, name, display_name, image, type, version, description,
			pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
			FROM builder_images WHERE is_preset = $1 ORDER BY created_at DESC`, isPreset)
	return imgs, err
}

// ListByType filters images by type.
func (r *BuilderImageRepository) ListByType(ctx context.Context, typ string) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	err := r.db.SelectContext(ctx, &imgs,
		`SELECT id, name, display_name, image, type, version, description,
			pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
			FROM builder_images WHERE type = $1 ORDER BY created_at DESC`, typ)
	return imgs, err
}

// ListByStatus filters images by status.
func (r *BuilderImageRepository) ListByStatus(ctx context.Context, status string) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	err := r.db.SelectContext(ctx, &imgs,
		`SELECT id, name, display_name, image, type, version, description,
			pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
			FROM builder_images WHERE status = $1 ORDER BY created_at DESC`, status)
	return imgs, err
}

// FindActive returns all images with active status.
func (r *BuilderImageRepository) FindActive(ctx context.Context) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	err := r.db.SelectContext(ctx, &imgs,
		`SELECT id, name, display_name, image, type, version, description,
			pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
			FROM builder_images WHERE status = $1 ORDER BY created_at DESC`,
		string(models.BuilderImageStatusActive))
	return imgs, err
}

// FindByTypeAndActive returns active images of a given type.
func (r *BuilderImageRepository) FindByTypeAndActive(ctx context.Context, typ string) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	err := r.db.SelectContext(ctx, &imgs,
		`SELECT id, name, display_name, image, type, version, description,
			pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
			FROM builder_images WHERE type = $1 AND status = $2 ORDER BY created_at DESC`,
		typ, string(models.BuilderImageStatusActive))
	return imgs, err
}

// Update modifies image metadata.
func (r *BuilderImageRepository) Update(ctx context.Context, img *models.BuilderImage) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE builder_images SET display_name = $1, description = $2, pull_policy = $3,
			status = $4, env = $5, labels = $6, updated_at = NOW() WHERE id = $7`,
		img.DisplayName, img.Description, img.PullPolicy, img.Status, img.Env, img.Labels, img.ID)
	return err
}

// UpdateStatus changes the image status.
func (r *BuilderImageRepository) UpdateStatus(ctx context.Context, id, status string) (*models.BuilderImage, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE builder_images SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// Delete removes an image (hard delete).
func (r *BuilderImageRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM builder_images WHERE id = $1`, id)
	return err
}

func limitOrDefault(limit, fallback int) int {
	if limit > 0 {
		return limit
	}
	return fallback
}
