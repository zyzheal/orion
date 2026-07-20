package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/message-queue/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.MessageQueue) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO message-queue (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MessageQueue, error) {
	var m models.MessageQueue
	err := r.db.GetContext(ctx, &m, `SELECT * FROM message-queue WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.MessageQueue, error) {
	var items []models.MessageQueue
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM message-queue WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MessageQueue, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE message-queue SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM message-queue WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
