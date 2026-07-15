package repository

import (
	"context"
	"database/sql"
	"errors"

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

func (r *Repository) Create(ctx context.Context, tenantID string, record *models.ApkUploadRecord) (*models.ApkUploadRecord, error) {
	record.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO apk_upload_history (id, tenant_id, market, version, status, created_at, updated_at) VALUES (:id, :tenantId, :market, :version, :status, :createdAt, :updatedAt)`,
		record)
	return record, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error) {
	var record models.ApkUploadRecord
	err := r.db.GetContext(ctx, &record,
		`SELECT * FROM apk_upload_history WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error) {
	where := "tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if q.Market != "" {
		where += " AND market = $" + string(rune(idx)) + "s"
		args = append(args, q.Market)
		idx++
	}
	if q.Status != "" {
		where += " AND status = $" + string(rune(idx)) + "s"
		args = append(args, q.Status)
		idx++
	}
	limit := 20
	offset := 0
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	if q.Offset != nil && *q.Offset >= 0 {
		offset = *q.Offset
	}
	var total int
	r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM apk_upload_history WHERE "+where, args...)
	var records []models.ApkUploadRecord
	r.db.SelectContext(ctx, &records,
		"SELECT * FROM apk_upload_history WHERE "+where+" ORDER BY created_at DESC LIMIT $"+string(rune(idx))+ " OFFSET $"+string(rune(idx+1)),
		append(args, limit, offset)...)
	return records, total, nil
}

func (r *Repository) RecentFailures(ctx context.Context, tenantID string) ([]models.ApkUploadRecord, error) {
	var records []models.ApkUploadRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM apk_upload_history WHERE tenant_id=$1 AND status='failed' ORDER BY created_at DESC LIMIT 10`, tenantID)
	return records, err
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS apk_upload_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			market VARCHAR(255) NOT NULL,
			version VARCHAR(255) NOT NULL,
			status VARCHAR(50) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)
	`)
	return err
}
