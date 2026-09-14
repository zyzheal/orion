package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact/models"
)

// Every SELECT below names its columns explicitly instead of using *.
//
// go-common's database.Connect goes through sqlx.Open and never calls Unsafe,
// so sqlx scans in safe mode and a wildcard select dies on the first row as
// soon as a migration adds a column the models do not declare. Migration 572
// added updated_by to artifacts and created_by / updated_by / updated_at to the
// three sub-tables, none of which models.Artifact and friends declare, so all
// nine SELECT * in this file were already failing with
// "missing destination name updated_by" and every read endpoint answered 500
// instead of data. Naming the columns returns exactly what the models declare.
const (
	artifactColumns = "id, tenant_id, name, namespace, version, type, status, " +
		"size_bytes, checksum_sha256, checksum_sha512, metadata, storage_path, " +
		"created_by, created_at, updated_at, deleted_at"

	downloadColumns = "id, tenant_id, artifact_id, downloaded_by, downloaded_at, " +
		"ip_address, user_agent"

	promotionColumns = "id, tenant_id, artifact_id, from_stage, to_stage, " +
		"promoted_by, approved_by, reason, created_at"
)

const (
	defaultLimit = 50
	maxLimit     = 500
)

// updateableColumns is the whitelist Update accepts. The keys of the incoming
// map would otherwise be spliced straight into the statement text, which is SQL
// injection, and the columns are few enough to enumerate them.
var updateableColumns = map[string]bool{
	"status":   true,
	"metadata": true,
}

// Repository is the data access layer for artifacts and their sub-resources.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getOne turns the driver's sql.ErrNoRows into sentinel.NotFound. The handler
// answers 404 only for errors.Is(err, sentinel.NotFound), so returning the raw
// driver error would turn a missing id into 500 "sql: no rows".
func (r *Repository) getOne(ctx context.Context, dest any, query string, args ...any) error {
	err := r.db.GetContext(ctx, dest, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return sentinel.NotFound
	}
	return err
}

// page clamps a caller-supplied limit and offset so one request can neither
// pull the whole table nor push OFFSET past the end of the result set.
func page(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// --- CRUD ---

// Create inserts a new artifact. metadata is a JSONB column, so an empty string
// would be rejected by Postgres; default it to an empty object instead.
func (r *Repository) Create(ctx context.Context, m *models.Artifact) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Metadata == "" {
		m.Metadata = "{}"
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO artifacts
			(id, tenant_id, name, namespace, version, type, status, size_bytes,
			 checksum_sha256, checksum_sha512, metadata, storage_path,
			 created_by, created_at, updated_at)
		VALUES
			(:id, :tenant_id, :name, :namespace, :version, :type, :status, :size_bytes,
			 :checksum_sha256, :checksum_sha512, :metadata, :storage_path,
			 :created_by, :created_at, :updated_at)`, m)
	return err
}

// GetByID returns one of the tenant's artifacts, or sentinel.NotFound.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	m := &models.Artifact{}
	if err := r.getOne(ctx, m,
		`SELECT `+artifactColumns+` FROM artifacts WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,
		tenantID, id); err != nil {
		return nil, err
	}
	return m, nil
}

func (r *Repository) ExistsByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifacts WHERE tenant_id=$1 AND namespace=$2 AND name=$3 AND version=$4 AND deleted_at IS NULL`,
		tenantID, namespace, name, version)
	return count > 0, err
}

// listWhere renders the shared filter predicate. Each clause gets the next
// placeholder number so the generated statement is checked positionally by the
// sqlmock tests instead of by regex.
func listWhere(q models.ListArtifactsQuery, tenantID string) (where string, args []interface{}) {
	parts := []string{"tenant_id=$1", "deleted_at IS NULL"}
	args = []interface{}{tenantID}
	for _, f := range []struct {
		col string
		val string
	}{
		{"namespace", q.Namespace},
		{"name", q.Name},
		{"type", q.Type},
		{"status", q.Status},
	} {
		if f.val == "" {
			continue
		}
		args = append(args, f.val)
		parts = append(parts, fmt.Sprintf("%s=$%d", f.col, len(args)))
	}
	return strings.Join(parts, " AND "), args
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) ([]models.Artifact, error) {
	limit, offset := page(q.Limit, q.Offset)
	where, args := listWhere(q, tenantID)
	args = append(args, limit, offset)
	sql := fmt.Sprintf(`SELECT `+artifactColumns+` FROM artifacts WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args), len(args)+1)

	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (int, error) {
	where, args := listWhere(q, tenantID)
	var count int
	err := r.db.GetContext(ctx, &count,
		fmt.Sprintf(`SELECT COUNT(*) FROM artifacts WHERE %s`, where), args...)
	return count, err
}

// Update applies the whitelisted columns.
//
// The statement is built with positional placeholders end to end. Mixing a
// named map with positional placeholders -- the previous implementation -- made
// sqlx reuse the numbers, so
//
//	UPDATE artifacts SET status = $1, updated_at = $2 WHERE id=$1 AND tenant_id=$2
//
// reached the driver with the status string bound to $1 and the tenant bound to
// $2; the WHERE clause could never match, RowsAffected was 0, the error was
// nil, and PUT /artifacts/:id answered 200 having changed nothing.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	cols := make([]string, 0, len(updates))
	for col := range updates {
		if !updateableColumns[col] {
			return fmt.Errorf("artifact: cannot update column %q: %w", col, sentinel.BadRequest)
		}
		cols = append(cols, col)
	}
	sort.Strings(cols)

	sets := make([]string, 0, len(cols)+1)
	args := make([]interface{}, 0, len(cols)+2)
	for _, col := range cols {
		args = append(args, updates[col])
		sets = append(sets, fmt.Sprintf("%s=$%d", col, len(args)))
	}
	sets = append(sets, "updated_at=NOW()")
	args = append(args, id, tenantID)
	sql := fmt.Sprintf(`UPDATE artifacts SET %s WHERE id=$%d AND tenant_id=$%d AND deleted_at IS NULL`,
		strings.Join(sets, ", "), len(args)-1, len(args))

	res, err := r.db.ExecContext(ctx, sql, args...)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("artifact %s: %w", id, sentinel.NotFound)
	}
	return nil
}

// SoftDelete marks the row deleted. A zero-row update means the id is not this
// tenant's, so it reports NotFound rather than a silent success.
func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE artifacts SET deleted_at=NOW() WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,
		tenantID, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("artifact %s: %w", id, sentinel.NotFound)
	}
	return nil
}

// --- Tags ---

// AddTags attaches tags. The insert is conditional because artifact_tags has no
// unique constraint on (artifact_id, tag), so the ON CONFLICT (artifact_id, tag)
// clause the previous version used was invalid SQL and the whole request failed.
// The tenant is bound as well: without it a tag named "latest" on artifact X of
// one tenant would satisfy the NOT EXISTS for another tenant's artifact.
func (r *Repository) AddTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	for _, tag := range tags {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO artifact_tags (id, tenant_id, artifact_id, tag, created_at)
			SELECT $1, $2, $3, $4, NOW()
			WHERE NOT EXISTS (
				SELECT 1 FROM artifact_tags WHERE tenant_id=$2 AND artifact_id=$3 AND tag=$4
			)`,
			uuid.New().String(), tenantID, artifactID, tag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) RemoveTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	for _, tag := range tags {
		_, err := r.db.ExecContext(ctx,
			`DELETE FROM artifact_tags WHERE tenant_id=$1 AND artifact_id=$2 AND tag=$3`,
			tenantID, artifactID, tag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetTags(ctx context.Context, tenantID, artifactID string) ([]string, error) {
	var tags []string
	err := r.db.SelectContext(ctx, &tags,
		`SELECT tag FROM artifact_tags WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC`,
		tenantID, artifactID)
	return tags, err
}

// --- Downloads ---

func (r *Repository) RecordDownload(ctx context.Context, tenantID, artifactID string, req models.DownloadArtifactRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_downloads (id, tenant_id, artifact_id, downloaded_by, downloaded_at, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), tenantID, artifactID, req.DownloadedBy, time.Now().UTC(), req.IPAddress, req.UserAgent)
	return err
}

func (r *Repository) GetDownloadHistory(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactDownload, error) {
	var items []models.ArtifactDownload
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+downloadColumns+` FROM artifact_downloads WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY downloaded_at DESC LIMIT 100`,
		tenantID, artifactID)
	return items, err
}

// --- Search ---

func (r *Repository) Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error) {
	limit, offset = page(limit, offset)
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+artifactColumns+` FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL
			AND (name ILIKE $2 OR namespace ILIKE $2 OR version ILIKE $2)
			ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, "%"+query+"%", limit, offset)
	return items, err
}

// --- Promote ---

func (r *Repository) CreatePromotion(ctx context.Context, p *models.ArtifactPromotion) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	p.CreatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_promotions (id, tenant_id, artifact_id, from_stage, to_stage, promoted_by, approved_by, reason, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		p.ID, p.TenantID, p.ArtifactID, p.FromStage, p.ToStage, p.PromotedBy, p.ApprovedBy, p.Reason, p.CreatedAt)
	return err
}

func (r *Repository) GetCurrentStage(ctx context.Context, tenantID, id string) (string, error) {
	var stage string
	err := r.db.GetContext(ctx, &stage,
		`SELECT to_stage FROM artifact_promotions WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC LIMIT 1`,
		tenantID, id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return stage, nil
}

func (r *Repository) GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error) {
	var items []models.ArtifactPromotion
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+promotionColumns+` FROM artifact_promotions WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC`,
		tenantID, id)
	return items, err
}

// --- Stats ---

// countRow is the aggregation row. Scanning into a typed struct instead of
// map[string]interface{} removes the row["type"].(string) and row["count"].(int64)
// assertions that panicked on any unexpected driver type.
type countRow struct {
	Bucket string `db:"bucket"`
	Count  int    `db:"count"`
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	stats := &models.ArtifactStats{
		ByType:   make(map[string]int),
		ByStatus: make(map[string]int),
	}
	if err := r.db.GetContext(ctx, stats,
		`SELECT COUNT(*) AS total, COALESCE(SUM(size_bytes), 0) AS total_size_bytes
		 FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL`, tenantID); err != nil {
		return nil, err
	}

	var byType []countRow
	if err := r.db.SelectContext(ctx, &byType,
		`SELECT type AS bucket, COUNT(*) AS count FROM artifacts
		 WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type`, tenantID); err != nil {
		return nil, err
	}
	for _, row := range byType {
		stats.ByType[row.Bucket] = row.Count
	}

	var byStatus []countRow
	if err := r.db.SelectContext(ctx, &byStatus,
		`SELECT status AS bucket, COUNT(*) AS count FROM artifacts
		 WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`, tenantID); err != nil {
		return nil, err
	}
	for _, row := range byStatus {
		stats.ByStatus[row.Bucket] = row.Count
	}

	return stats, nil
}

func (r *Repository) GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error) {
	var items []models.ArtifactTypeStat
	err := r.db.SelectContext(ctx, &items,
		`SELECT type AS type, COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS size
		 FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type`, tenantID)
	return items, err
}

func (r *Repository) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	var items []models.NamespaceStat
	err := r.db.SelectContext(ctx, &items,
		`SELECT namespace, COUNT(*) AS count FROM artifacts
		 WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY namespace`, tenantID)
	return items, err
}
