package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/artifact/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CRUD ---

func (r *Repository) Create(ctx context.Context, m *models.Artifact) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO artifacts (id, tenant_id, name, namespace, version, type, status, size_bytes,
		checksum_sha256, checksum_sha512, metadata, storage_path, created_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :namespace, :version, :type, :status, :size_bytes,
		:checksum_sha256, :checksum_sha512, :metadata, :storage_path, :created_by, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	var m models.Artifact
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM artifacts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ExistsByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$1 AND namespace=$2 AND name=$3 AND version=$4 AND deleted_at IS NULL`,
		tenantID, namespace, name, version)
	return count > 0, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) ([]models.Artifact, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var sql string
	var args []interface{}
	paramIdx := 1

	if q.Namespace != "" && q.Name != "" && q.Type != "" && q.Status != "" {
		sql = fmt.Sprintf(`SELECT * FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND type=$%d AND status=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3, paramIdx+4, paramIdx+5, paramIdx+6)
		args = []interface{}{tenantID, q.Namespace, q.Name, q.Type, q.Status, q.Limit, q.Offset}
	} else if q.Namespace != "" && q.Name != "" && q.Type != "" {
		sql = fmt.Sprintf(`SELECT * FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND type=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3, paramIdx+4, paramIdx+5)
		args = []interface{}{tenantID, q.Namespace, q.Name, q.Type, q.Limit, q.Offset}
	} else if q.Namespace != "" && q.Name != "" {
		sql = fmt.Sprintf(`SELECT * FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3, paramIdx+4)
		args = []interface{}{tenantID, q.Namespace, q.Name, q.Limit, q.Offset}
	} else if q.Namespace != "" {
		sql = fmt.Sprintf(`SELECT * FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3)
		args = []interface{}{tenantID, q.Namespace, q.Limit, q.Offset}
	} else {
		sql = fmt.Sprintf(`SELECT * FROM artifacts WHERE tenant_id=$%d AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			paramIdx, paramIdx+1, paramIdx+2)
		args = []interface{}{tenantID, q.Limit, q.Offset}
	}

	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (int, error) {
	var sql string
	var args []interface{}
	paramIdx := 1

	if q.Namespace != "" && q.Name != "" && q.Type != "" && q.Status != "" {
		sql = fmt.Sprintf(`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND type=$%d AND status=$%d AND deleted_at IS NULL`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3, paramIdx+4)
		args = []interface{}{tenantID, q.Namespace, q.Name, q.Type, q.Status}
	} else if q.Namespace != "" && q.Name != "" && q.Type != "" {
		sql = fmt.Sprintf(`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND type=$%d AND deleted_at IS NULL`,
			paramIdx, paramIdx+1, paramIdx+2, paramIdx+3)
		args = []interface{}{tenantID, q.Namespace, q.Name, q.Type}
	} else if q.Namespace != "" && q.Name != "" {
		sql = fmt.Sprintf(`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND name=$%d AND deleted_at IS NULL`,
			paramIdx, paramIdx+1, paramIdx+2)
		// Reuse args from List
		args = []interface{}{tenantID, q.Namespace, q.Name}
	} else if q.Namespace != "" {
		sql = fmt.Sprintf(`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$%d AND namespace=$%d AND deleted_at IS NULL`,
			paramIdx, paramIdx+1)
		args = []interface{}{tenantID, q.Namespace}
	} else {
		sql = `SELECT COUNT(*) FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL`
		args = []interface{}{tenantID}
	}

	var count int
	err := r.db.GetContext(ctx, &count, sql, args...)
	return count, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sql := fmt.Sprintf(`UPDATE artifacts SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifacts SET deleted_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Tags ---

func (r *Repository) AddTags(ctx context.Context, artifactID string, tags []string) error {
	for _, tag := range tags {
		_, err := r.db.NamedExecContext(ctx,
			`INSERT INTO artifact_tags (id, artifact_id, tag, created_at)
				VALUES (:id, :artifact_id, :tag, :created_at)
				ON CONFLICT (artifact_id, tag) DO NOTHING`,
			map[string]interface{}{
				"id":          uuid.New().String(),
				"artifact_id": artifactID,
				"tag":         tag,
				"created_at":  time.Now().UTC(),
			})
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) RemoveTags(ctx context.Context, artifactID string, tags []string) error {
	for _, tag := range tags {
		_, err := r.db.ExecContext(ctx,
			`DELETE FROM artifact_tags WHERE artifact_id=$1 AND tag=$2`, artifactID, tag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetTags(ctx context.Context, artifactID string) ([]string, error) {
	var tags []string
	err := r.db.SelectContext(ctx, &tags,
		`SELECT tag FROM artifact_tags WHERE artifact_id=$1 ORDER BY created_at DESC`, artifactID)
	return tags, err
}

// --- Downloads ---

func (r *Repository) RecordDownload(ctx context.Context, artifactID string, req models.DownloadArtifactRequest) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_downloads (id, artifact_id, downloaded_by, downloaded_at, ip_address, user_agent)
			VALUES (:id, :artifact_id, :downloaded_by, :downloaded_at, :ip_address, :user_agent)`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"artifact_id":   artifactID,
			"downloaded_by": req.DownloadedBy,
			"downloaded_at": time.Now().UTC(),
			"ip_address":    req.IPAddress,
			"user_agent":    req.UserAgent,
		})
	return err
}

func (r *Repository) GetDownloadHistory(ctx context.Context, artifactID string) ([]models.ArtifactDownload, error) {
	var items []models.ArtifactDownload
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_downloads WHERE artifact_id=$1 ORDER BY downloaded_at DESC LIMIT 100`, artifactID)
	return items, err
}

// --- Search ---

func (r *Repository) Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL
			AND (name ILIKE $2 OR namespace ILIKE $2 OR version ILIKE $2)
			ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, "%"+query+"%", limit, offset)
	return items, err
}

// --- Promote ---

func (r *Repository) CreatePromotion(ctx context.Context, p *models.ArtifactPromotion) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_promotions (id, artifact_id, from_stage, to_stage, promoted_by, approved_by, reason, created_at)
			VALUES (:id, :artifact_id, :from_stage, :to_stage, :promoted_by, :approved_by, :reason, :created_at)`,
		p)
	return err
}

func (r *Repository) GetCurrentStage(ctx context.Context, tenantID, id string) (string, error) {
	var stage string
	err := r.db.GetContext(ctx, &stage,
		`SELECT to_stage FROM artifact_promotions WHERE artifact_id=$1 ORDER BY created_at DESC LIMIT 1`, id)
	if err != nil {
		return "", err
	}
	return stage, nil
}

func (r *Repository) GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error) {
	var items []models.ArtifactPromotion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_promotions WHERE artifact_id=$1 ORDER BY created_at DESC`, id)
	return items, err
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	var stats models.ArtifactStats
	err := r.db.GetContext(ctx, &stats,
		`SELECT COUNT(*) as total, COALESCE(SUM(size_bytes), 0) as total_size_bytes
			FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL`, tenantID)
	if err != nil {
		return nil, err
	}

	// By type
	var typeCounts []map[string]interface{}
	err = r.db.SelectContext(ctx, &typeCounts,
		`SELECT type, COUNT(*) as count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.ByType = make(map[string]int)
	for _, row := range typeCounts {
		stats.ByType[row["type"].(string)] = int(row["count"].(int64))
	}

	// By status
	var statusCounts []map[string]interface{}
	err = r.db.SelectContext(ctx, &statusCounts,
		`SELECT status, COUNT(*) as count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.ByStatus = make(map[string]int)
	for _, row := range statusCounts {
		stats.ByStatus[row["status"].(string)] = int(row["count"].(int64))
	}

	return &stats, nil
}

func (r *Repository) GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error) {
	var items []models.ArtifactTypeStat
	err := r.db.SelectContext(ctx, &items,
		`SELECT type as type, COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as size
			FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type`, tenantID)
	return items, err
}

func (r *Repository) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	var items []models.NamespaceStat
	err := r.db.SelectContext(ctx, &items,
		`SELECT namespace, COUNT(*) as count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY namespace`, tenantID)
	return items, err
}

// joinStrings is a simple helper for joining strings with a separator.
func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
