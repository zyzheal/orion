package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/ai-inference/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("inference record not found")

// Repository provides PostgreSQL-backed persistence for AI inference/decision audit records.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new inference/decision audit record.
func (r *Repository) Create(ctx context.Context, rec *models.InferenceRecord) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_inference_history (
			id, tenant_id, user_id, service, type, model, input_type,
			request_payload, response_payload, success, error, duration_seconds, created_at
		) VALUES (:id, :tenantId, :userId, :service, :type, :model, :inputType,
			:requestPayload, :responsePayload, :success, :error, :durationSeconds, :createdAt)`,
		rec)
	return err
}

// GetByID retrieves a single record by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.InferenceRecord, error) {
	var rec models.InferenceRecord
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM ai_inference_history WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// List retrieves records for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListRecordFilter, offset, limit int) ([]models.InferenceRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := "SELECT * FROM ai_inference_history WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Type != nil && *filter.Type != "" {
			query += fmt.Sprintf(" AND type=$%d", argIdx)
			args = append(args, *filter.Type)
			argIdx++
		}
		if filter.Service != nil && *filter.Service != "" {
			query += fmt.Sprintf(" AND service=$%d", argIdx)
			args = append(args, *filter.Service)
			argIdx++
		}
		if filter.Success != nil {
			query += fmt.Sprintf(" AND success=$%d", argIdx)
			args = append(args, *filter.Success)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	var items []models.InferenceRecord
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of records for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ai_inference_history WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountByType returns the number of records of a given type for a tenant.
func (r *Repository) CountByType(ctx context.Context, tenantID, recType string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ai_inference_history WHERE tenant_id=$1 AND type=$2`, tenantID, recType)
	return count, err
}

// DeleteByRetention removes records older than the given cutoff for a tenant (retention policy).
func (r *Repository) DeleteByRetention(ctx context.Context, tenantID string, cutoff interface{}) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_inference_history WHERE tenant_id=$1 AND created_at<$2`, tenantID, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// IsNotFound reports whether the given error is a sql.ErrNoRows.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows
}
