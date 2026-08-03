package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/ai/review/models"

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

func (r *Repository) Create(ctx context.Context, m *models.ReviewRequest) error {
	m.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_review (id, tenant_id, content, status, score, suggestions, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :content, :status, :score, :suggestions, :created_by, NOW(), NOW())`,
		m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error) {
	var m models.ReviewRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM ai_review WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListReviewsQuery) ([]models.ReviewRequest, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT * FROM ai_review WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.ReviewRequest
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListReviewsQuery) (int, error) {
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT COUNT(*) FROM ai_review WHERE %s", where)
	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_review SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}
