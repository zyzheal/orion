package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/data-pipeline/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("data-pipeline not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM data_pipelines WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM data_pipelines WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	now := time.Now()
	record := models.Record{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Status:    req.Status,
		Config:    req.Config,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if record.Status == "" {
		record.Status = "draft"
	}
	if record.Config == nil {
		record.Config = map[string]interface{}{}
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO data_pipelines (id, tenant_id, name, status, config, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		record.ID, record.TenantID, record.Name, record.Status, record.Config, record.CreatedAt, record.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	now := time.Now()
	status := req.Status
	if status == "" {
		status = "draft"
	}
	config := req.Config
	if config == nil {
		config = map[string]interface{}{}
	}
	result, err := r.db.ExecContext(ctx,
		`UPDATE data_pipelines SET name=$1, status=$2, config=$3, updated_at=$4
		 WHERE id=$5 AND tenant_id=$6`,
		req.Name, status, config, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, ErrNotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM data_pipelines WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}