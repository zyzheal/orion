package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion-ticket-svc-go/internal/ticket-knowledge/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.TicketKnowledge) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO ticket_knowledge (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.TicketKnowledge, error) {
	var m models.TicketKnowledge
	err := r.db.GetContext(ctx, &m, `SELECT * FROM ticket_knowledge WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.TicketKnowledge, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.TicketKnowledge
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM ticket_knowledge WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `UPDATE ticket_knowledge SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM ticket_knowledge WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
