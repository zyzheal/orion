package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/apk-upload-history/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("apk upload record not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS apk_uploads (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		market VARCHAR(64) NOT NULL,
		package_name VARCHAR(255) NOT NULL,
		version VARCHAR(128) NOT NULL,
		version_code INTEGER DEFAULT 0,
		file_name VARCHAR(255) NOT NULL,
		file_size BIGINT DEFAULT 0,
		checksum VARCHAR(64) DEFAULT '',
		status VARCHAR(32) DEFAULT 'pending',
		uploaded_by VARCHAR(128) DEFAULT '',
		error_msg TEXT DEFAULT '',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_apk_uploads_tenant ON apk_uploads(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_apk_uploads_market ON apk_uploads(tenant_id, market);
	CREATE INDEX IF NOT EXISTS idx_apk_uploads_package ON apk_uploads(tenant_id, package_name);
	`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.ApkUploadRecord) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	if m.Status == "" {
		m.Status = models.StatusPending
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO apk_uploads (id, tenant_id, market, package_name, version, version_code,
			file_name, file_size, checksum, status, uploaded_by, error_msg, created_at, updated_at)
		VALUES (:id, :tenant_id, :market, :package_name, :version, :version_code,
			:file_name, :file_size, :checksum, :status, :uploaded_by, :error_msg, :created_at, :updated_at)`,
		m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error) {
	var m models.ApkUploadRecord
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM apk_uploads WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error) {
	cond := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if q.Market != "" {
		cond += " AND market = $" + strconv.Itoa(idx)
		args = append(args, q.Market)
		idx++
	}
	if q.Status != "" {
		cond += " AND status = $" + strconv.Itoa(idx)
		args = append(args, q.Status)
		idx++
	}
	if q.PackageName != "" {
		cond += " AND package_name = $" + strconv.Itoa(idx)
		cond += " LIKE $" + strconv.Itoa(idx)
		args = append(args, "%"+q.PackageName+"%")
		idx++
	}

	limit := 20
	offset := 0
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	if q.Offset != nil {
		offset = *q.Offset
	}

	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM apk_uploads "+cond, args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.ApkUploadRecord
	err = r.db.SelectContext(ctx, &items,
		cond+" ORDER BY created_at DESC LIMIT $"+strconv.Itoa(idx)+" OFFSET $"+strconv.Itoa(idx+1),
		append(args, limit, offset)...)
	return items, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ApkUploadRecord, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		set = append(set, k+"=$"+strconv.Itoa(i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := "UPDATE apk_uploads SET " + strings.Join(set, ", ") + " WHERE id=$" + strconv.Itoa(idIdx) + " AND tenant_id=$" + strconv.Itoa(tenantIdx)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM apk_uploads WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *Repository) RecentFailures(ctx context.Context, tenantID string, limit int) ([]models.ApkUploadRecord, error) {
	var items []models.ApkUploadRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM apk_uploads WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, string(models.StatusFailed), limit)
	return items, err
}

func (r *Repository) Stats(ctx context.Context, tenantID string) (*models.ApkUploadStats, error) {
	stats := &models.ApkUploadStats{}
	err := r.db.GetContext(ctx, stats, `
		SELECT
			COUNT(*) AS total_uploads,
			SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) AS success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
			COALESCE(SUM(file_size), 0) AS total_size,
			COALESCE(MAX(created_at), NOW()) AS last_upload_at
		FROM apk_uploads WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *Repository) ExistsByVersion(ctx context.Context, tenantID, market, packageName, version string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM apk_uploads
		WHERE tenant_id = $1 AND market = $2 AND package_name = $3 AND version = $4`,
		tenantID, market, packageName, version)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
