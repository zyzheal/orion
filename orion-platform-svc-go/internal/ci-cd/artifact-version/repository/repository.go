package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"orion/platform-svc-go/internal/ci-cd/artifact-version/models"
)

type ArtifactVersionRepository struct {
	db *sqlx.DB
}

func NewArtifactVersionRepository(db *sqlx.DB) *ArtifactVersionRepository {
	return &ArtifactVersionRepository{db: db}
}

func (r *ArtifactVersionRepository) Create(ctx context.Context, v *models.ArtifactVersion) error {
	now := time.Now()
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	if v.Status == "" {
		v.Status = "published"
	}

	query := `INSERT INTO artifact_versions (id, tenant_id, artifact_id, version, build_number, checksum, size, storage_path, status, metadata, build_job_id, created_at, deprecated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`
	_, err := r.db.ExecContext(ctx, query,
		v.ID, v.TenantID, v.ArtifactID, v.Version, v.BuildNumber, v.Checksum,
		v.Size, v.StoragePath, v.Status, v.Metadata, v.BuildJobID, now, sql.NullTime{},
	)
	return err
}

func (r *ArtifactVersionRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	var v models.ArtifactVersion
	query := `SELECT id, tenant_id, artifact_id, version, build_number, checksum, size, storage_path, status, metadata, build_job_id, created_at, deprecated_at FROM artifact_versions WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &v, query, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("version not found: %s", id)
	}
	return &v, err
}

func (r *ArtifactVersionRepository) Query(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactVersion, int64, error) {
	var total int64
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countArgs := []interface{}{tenantID}
	countQuery := `SELECT COUNT(*) FROM artifact_versions WHERE tenant_id = $1`
	if artifactID != "" {
		countQuery += ` AND artifact_id = $2`
		countArgs = append(countArgs, artifactID)
	}
	err := r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}

	var args []interface{}
	idx := 1
	query := fmt.Sprintf(`SELECT id, tenant_id, artifact_id, version, build_number, checksum, size, storage_path, status, metadata, build_job_id, created_at, deprecated_at FROM artifact_versions WHERE tenant_id = $%d`, idx)
	args = append(args, tenantID)
	idx++
	if artifactID != "" {
		query += fmt.Sprintf(` AND artifact_id = $%d`, idx)
		args = append(args, artifactID)
		idx++
	}
	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, idx, idx+1)
	args = append(args, limit, offset)

	var versions []models.ArtifactVersion
	err = r.db.SelectContext(ctx, &versions, query, args...)
	return versions, total, err
}

func (r *ArtifactVersionRepository) UpdateStatus(ctx context.Context, tenantID, id, status string, deprecatedAt *time.Time) error {
	now := time.Now()
	var nullDeprecated sql.NullTime
	if deprecatedAt != nil {
		nullDeprecated = sql.NullTime{Time: *deprecatedAt, Valid: true}
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_versions SET status = $1, deprecated_at = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`,
		status, nullDeprecated, now, id, tenantID)
	return err
}

func (r *ArtifactVersionRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM artifact_versions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("version not found: %s", id)
	}
	return nil
}
