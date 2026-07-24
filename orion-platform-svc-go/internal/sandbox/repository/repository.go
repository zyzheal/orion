package repository

import (
	"context"
	"strconv"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/sandbox/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.SandboxJob) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Status == "" {
		m.Status = models.JobStatusPending
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO sandbox_jobs (id, tenant_id, code, language, status, max_cpu, max_memory,
			timeout_sec, network, file_access, created_at, updated_at)
		VALUES (:id, :tenant_id, :code, :language, :status, :max_cpu, :max_memory,
			:timeout_sec, :network, :file_access, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.SandboxJob, error) {
	var m models.SandboxJob
	err := r.db.GetContext(ctx, &m, `SELECT * FROM sandbox_jobs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, status string) ([]models.SandboxJob, error) {
	var items []models.SandboxJob
	query := `SELECT * FROM sandbox_jobs WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SandboxJob, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE sandbox_jobs SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sandbox_jobs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
