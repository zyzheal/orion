package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/inspection/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM records WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM records WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	if req.Status == "" {
		req.Status = "pending"
	}
	var metadataJSON string
	if len(req.Config) > 0 {
		if b, err := json.Marshal(req.Config); err == nil {
			metadataJSON = string(b)
		}
	}
	now := time.Now().UTC()
	id := uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO records (id, tenant_id, name, status, metadata, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :status, :metadata, :createdAt, :updatedAt)`,
		map[string]interface{}{
			"id":         id,
			"tenantId":   tenantID,
			"name":       req.Name,
			"status":     req.Status,
			"metadata":   metadataJSON,
			"createdAt":  now,
			"updatedAt":  now,
		})
	if err != nil {
		return nil, err
	}
	rec := &models.Record{
		ID:       id,
		TenantID: tenantID,
		Name:     req.Name,
		Status:   req.Status,
		CreatedAt: now,
	}
	return rec, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	setParts := []string{"updated_at = $1"}
	args := []interface{}{time.Now().UTC()}
	idx := 2

	if req.Name != "" {
		setParts = append(setParts, "name = $"+string(rune('0'+idx)))
		args = append(args, req.Name)
		idx++
	}
	if req.Status != "" {
		setParts = append(setParts, "status = $"+string(rune('0'+idx)))
		args = append(args, req.Status)
		idx++
	}
	if len(req.Config) > 0 {
		metadataJSON, _ := json.Marshal(req.Config)
		setParts = append(setParts, "metadata = $"+string(rune('0'+idx)))
		args = append(args, string(metadataJSON))
		idx++
	}
	args = append(args, id, tenantID)
	nameIdx := idx
	tenantIdx := idx + 1

	query := "UPDATE records SET " + joinSetParts(setParts) +
		" WHERE id = $" + fmt.Sprintf("%d", nameIdx) + " AND tenant_id = $" + fmt.Sprintf("%d", tenantIdx) +
		" AND deleted_at IS NULL"
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		"UPDATE records SET deleted_at = $1 WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
		time.Now().UTC(), id, tenantID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- Helpers ---

func joinSetParts(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}
