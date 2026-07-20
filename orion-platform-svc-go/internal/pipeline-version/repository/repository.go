package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pipeline-version/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateVersion(ctx context.Context, v *models.PipelineVersion) error {
	v.ID = uuid.New().String()
	now := time.Now().UTC()
	v.CreatedAt = now
	if v.Tags == "" {
		v.Tags = "[]"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_versions (id, tenant_id, pipeline_id, version, yaml_definition, description, tags, is_baseline, created_by, created_at)
		 VALUES (:id, :tenantId, :pipelineId, :version, :yamlDefinition, :description, :tags, :isBaseline, :createdBy, :createdAt)`,
		v)
	return err
}

func (r *Repository) GetVersionByID(ctx context.Context, id string, tenantID string) (*models.PipelineVersion, error) {
	var v models.PipelineVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM pipeline_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *Repository) GetVersionByPipelineAndVersion(ctx context.Context, pipelineID string, version string, tenantID string) (*models.PipelineVersion, error) {
	var v models.PipelineVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM pipeline_versions WHERE pipeline_id=$1 AND version=$2 AND tenant_id=$3`,
		pipelineID, version, tenantID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *Repository) ListVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) ([]models.PipelineVersion, error) {
	var versions []models.PipelineVersion
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM pipeline_versions WHERE pipeline_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`,
		pipelineID, tenantID)
	return versions, err
}

func (r *Repository) CountVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_versions WHERE pipeline_id=$1 AND tenant_id=$2`,
		pipelineID, tenantID)
	return count, err
}

func (r *Repository) UpdateBaseline(ctx context.Context, id string, tenantID string, isBaseline bool) (*models.PipelineVersion, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET is_baseline=$1 WHERE id=$2 AND tenant_id=$3`,
		isBaseline, id, tenantID)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetVersionByID(ctx, id, tenantID)
}

func (r *Repository) UnsetAllBaselines(ctx context.Context, pipelineID string, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET is_baseline=false WHERE pipeline_id=$1 AND tenant_id=$2`,
		pipelineID, tenantID)
	return err
}

func (r *Repository) UpdateTags(ctx context.Context, id string, tenantID string, tags string) (*models.PipelineVersion, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_versions SET tags=$1 WHERE id=$2 AND tenant_id=$3`,
		tags, id, tenantID)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetVersionByID(ctx, id, tenantID)
}
