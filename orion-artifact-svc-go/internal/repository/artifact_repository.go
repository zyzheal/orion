package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/artifact-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides all database operations for artifacts, tags, downloads, and promotions.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ============================================================
// Artifact CRUD
// ============================================================

// Create inserts a new artifact record.
func (r *Repository) Create(ctx context.Context, a *models.Artifact) error {
	a.ID = uuid.New().String()
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = string(models.ArtifactStatusAvailable)
	}
	if a.Namespace == "" {
		a.Namespace = "default"
	}
	if a.Metadata == nil {
		a.Metadata = models.JSONB{}
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO artifacts (
			id, tenant_id, namespace, name, version, type, status,
			description, size_bytes, checksum_sha256, checksum_sha512,
			storage_path, repo_url, metadata, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17
		)`,
		a.ID, a.TenantID, a.Namespace, a.Name, a.Version, a.Type, a.Status,
		a.Description, a.SizeBytes, a.ChecksumSHA256, a.ChecksumSHA512,
		a.StoragePath, a.RepoURL, a.Metadata, a.CreatedBy, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single artifact by id and tenant, excluding soft-deleted.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	var a models.Artifact
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM artifacts WHERE id = $1 AND tenant_id = $2 AND status != 'deleted'`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetByNamespaceNameVersion finds an artifact by its unique triple.
func (r *Repository) GetByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (*models.Artifact, error) {
	var a models.Artifact
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM artifacts
		 WHERE tenant_id = $1 AND namespace = $2 AND name = $3 AND version = $4 AND status != 'deleted'`,
		tenantID, namespace, name, version,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// List retrieves paginated artifacts for a tenant with optional filters.
func (r *Repository) List(ctx context.Context, tenantID string, opts *models.ListQueryOptions) ([]models.Artifact, int, error) {
	where := []string{"tenant_id = $1", "status != 'deleted'"}
	args := []interface{}{tenantID}
	argIdx := 2

	if opts.Namespace != "" {
		where = append(where, fmt.Sprintf("namespace = $%d", argIdx))
		args = append(args, opts.Namespace)
		argIdx++
	}
	if opts.Name != "" {
		where = append(where, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, opts.Name)
		argIdx++
	}
	if opts.Type != "" {
		where = append(where, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, opts.Type)
		argIdx++
	}
	if opts.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, opts.Status)
		argIdx++
	}
	if opts.Search != "" {
		where = append(where, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+opts.Search+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total matching rows
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM artifacts WHERE %s", whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Fetch the requested page
	offset := opts.Offset()
	limit := opts.Limit()
	args = append(args, offset, limit)
	dataQuery := fmt.Sprintf(
		"SELECT * FROM artifacts WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d",
		whereClause, argIdx, argIdx+1,
	)

	var items []models.Artifact
	if err := r.db.SelectContext(ctx, &items, dataQuery, args...); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// ListByName retrieves all artifacts for a tenant with the given name.
func (r *Repository) ListByName(ctx context.Context, tenantID, name string) ([]models.Artifact, error) {
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifacts WHERE tenant_id = $1 AND name = $2 AND status != 'deleted' ORDER BY created_at DESC`,
		tenantID, name,
	)
	return items, err
}

// Update modifies mutable fields of an existing artifact.
func (r *Repository) Update(ctx context.Context, a *models.Artifact) error {
	a.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `
		UPDATE artifacts SET
			status = $3,
			description = $4,
			metadata = $5,
			updated_at = $6
		WHERE id = $1 AND tenant_id = $2`,
		a.ID, a.TenantID, a.Status, a.Description, a.Metadata, a.UpdatedAt,
	)
	return err
}

// SoftDelete marks an artifact as deleted without removing the row.
func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifacts SET status = 'deleted', updated_at = $3 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID, time.Now().UTC(),
	)
	return err
}

// HardDelete permanently removes an artifact record.
func (r *Repository) HardDelete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM artifacts WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// Count returns the number of non-deleted artifacts for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifacts WHERE tenant_id = $1 AND status != 'deleted'`,
		tenantID,
	)
	return count, err
}

// Search performs a full-text search across name and description.
func (r *Repository) Search(ctx context.Context, tenantID, query string) ([]models.Artifact, error) {
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifacts
		 WHERE tenant_id = $1 AND status != 'deleted'
		   AND (name ILIKE $2 OR description ILIKE $2)
		 ORDER BY created_at DESC LIMIT 50`,
		tenantID, "%"+query+"%",
	)
	return items, err
}

// ============================================================
// Tags
// ============================================================

// AddTag inserts a tag for an artifact (idempotent via ON CONFLICT).
func (r *Repository) AddTag(ctx context.Context, artifactID, tag string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_tags (id, artifact_id, tag, created_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (artifact_id, tag) DO NOTHING`,
		uuid.New().String(), artifactID, tag, time.Now().UTC(),
	)
	return err
}

// RemoveTag deletes a specific tag from an artifact.
func (r *Repository) RemoveTag(ctx context.Context, artifactID, tag string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM artifact_tags WHERE artifact_id = $1 AND tag = $2`,
		artifactID, tag,
	)
	return err
}

// GetTags retrieves all tags for an artifact, ordered by creation time.
func (r *Repository) GetTags(ctx context.Context, artifactID string) ([]models.ArtifactTag, error) {
	var tags []models.ArtifactTag
	err := r.db.SelectContext(ctx, &tags,
		`SELECT * FROM artifact_tags WHERE artifact_id = $1 ORDER BY created_at`,
		artifactID,
	)
	return tags, err
}

// ============================================================
// Download Records
// ============================================================

// RecordDownload inserts a download event.
func (r *Repository) RecordDownload(ctx context.Context, rec *models.DownloadRecord) error {
	rec.ID = uuid.New().String()
	rec.DownloadedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_downloads (id, artifact_id, downloaded_by, ip_address, user_agent, downloaded_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		rec.ID, rec.ArtifactID, rec.DownloadedBy, rec.IPAddress, rec.UserAgent, rec.DownloadedAt,
	)
	return err
}

// GetDownloadHistory retrieves download records for an artifact, newest first, capped at 100.
func (r *Repository) GetDownloadHistory(ctx context.Context, artifactID string) ([]models.DownloadRecord, error) {
	var records []models.DownloadRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM artifact_downloads WHERE artifact_id = $1 ORDER BY downloaded_at DESC LIMIT 100`,
		artifactID,
	)
	return records, err
}

// ============================================================
// Promotion Records
// ============================================================

// CreatePromotion inserts a new promotion record.
func (r *Repository) CreatePromotion(ctx context.Context, rec *models.PromotionRecord) error {
	rec.ID = uuid.New().String()
	rec.CreatedAt = time.Now().UTC()
	if rec.Status == "" {
		rec.Status = "completed"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_promotions (id, artifact_id, from_stage, to_stage, status, promoted_by, approved_by, approved_at, reason, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		rec.ID, rec.ArtifactID, rec.FromStage, rec.ToStage, rec.Status,
		rec.PromotedBy, rec.ApprovedBy, rec.ApprovedAt, rec.Reason, rec.CreatedAt,
	)
	return err
}

// ApprovePromotion updates a promotion record with approval info.
func (r *Repository) ApprovePromotion(ctx context.Context, promotionID, approvedBy string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_promotions SET approved_by = $2, approved_at = $3 WHERE id = $1`,
		promotionID, approvedBy, now,
	)
	return err
}

// GetLatestPromotion returns the most recent promotion for an artifact.
func (r *Repository) GetLatestPromotion(ctx context.Context, artifactID string) (*models.PromotionRecord, error) {
	var rec models.PromotionRecord
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM artifact_promotions WHERE artifact_id = $1 ORDER BY created_at DESC LIMIT 1`,
		artifactID,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// GetPromotionHistory returns all promotions for an artifact, newest first.
func (r *Repository) GetPromotionHistory(ctx context.Context, artifactID string) ([]models.PromotionRecord, error) {
	var records []models.PromotionRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM artifact_promotions WHERE artifact_id = $1 ORDER BY created_at DESC`,
		artifactID,
	)
	return records, err
}

// ============================================================
// Statistics
// ============================================================

// GetStats returns aggregate stats for a tenant's artifacts.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	var stats models.ArtifactStats
	err := r.db.GetContext(ctx, &stats,
		`SELECT
			COUNT(*) AS total_count,
			COUNT(CASE WHEN status = 'available' THEN 1 END) AS available_count,
			COUNT(CASE WHEN status = 'deprecated' THEN 1 END) AS deprecated_count,
			COUNT(CASE WHEN status = 'quarantined' THEN 1 END) AS quarantined_count,
			COALESCE(SUM(size_bytes), 0) AS total_size_bytes
		FROM artifacts
		WHERE tenant_id = $1 AND status != 'deleted'`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// GetTypeStats returns artifact counts grouped by type for a tenant.
func (r *Repository) GetTypeStats(ctx context.Context, tenantID string) ([]models.TypeStat, error) {
	var stats []models.TypeStat
	err := r.db.SelectContext(ctx, &stats,
		`SELECT type, COUNT(*) AS count
		 FROM artifacts
		 WHERE tenant_id = $1 AND status != 'deleted'
		 GROUP BY type
		 ORDER BY count DESC`,
		tenantID,
	)
	return stats, err
}

// GetNamespaces returns distinct namespaces for a tenant with artifact counts.
func (r *Repository) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	var namespaces []models.NamespaceStat
	err := r.db.SelectContext(ctx, &namespaces,
		`SELECT namespace, COUNT(*) AS count
		 FROM artifacts
		 WHERE tenant_id = $1 AND status != 'deleted'
		 GROUP BY namespace
		 ORDER BY namespace`,
		tenantID,
	)
	return namespaces, err
}
