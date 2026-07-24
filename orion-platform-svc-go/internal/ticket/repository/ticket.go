package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type TicketRepository struct {
	db *database.DB
}

func NewTicketRepository(db *database.DB) *TicketRepository {
	return &TicketRepository{db: db}
}

func (r *TicketRepository) Create(ctx context.Context, ticket *models.Ticket) error {
	query := `INSERT INTO tickets (id, tenant_id, title, description, type, priority, status, created_by, assigned_to)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.ExecContext(ctx, query,
		ticket.ID, ticket.TenantID, ticket.Title, ticket.Description,
		ticket.Type, ticket.Priority, ticket.Status, ticket.CreatedBy, ticket.AssignedTo,
	)
	return err
}

func (r *TicketRepository) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	var t models.Ticket
	err := r.db.GetContext(ctx, &t, "SELECT * FROM tickets WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TicketRepository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	var tickets []models.Ticket
	var total int

	where := "WHERE tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2

	if q.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, q.Status)
		argIdx++
	}
	if q.Type != "" {
		where += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, q.Type)
		argIdx++
	}
	if q.Priority != "" {
		where += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, q.Priority)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM tickets " + where
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	listQuery := "SELECT * FROM tickets " + where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d OFFSET %d", q.PageSize, offset)
	err = r.db.SelectContext(ctx, &tickets, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	return tickets, total, nil
}

func (r *TicketRepository) Update(ctx context.Context, ticket *models.Ticket) error {
	query := `UPDATE tickets SET title=$1, description=$2, type=$3, priority=$4, status=$5,
		assigned_to=$6, resolved_at=$7, closed_at=$8, updated_at=NOW() WHERE id=$9 AND tenant_id=$10`
	_, err := r.db.ExecContext(ctx, query,
		ticket.Title, ticket.Description, ticket.Type, ticket.Priority,
		ticket.Status, ticket.AssignedTo, ticket.ResolvedAt, ticket.ClosedAt,
		ticket.ID, ticket.TenantID,
	)
	return err
}

func (r *TicketRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tickets WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}

func (r *TicketRepository) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	if status == "resolved" {
		_, err := r.db.ExecContext(ctx, "UPDATE tickets SET status=$1, resolved_at=NOW(), updated_at=NOW() WHERE id=$2 AND tenant_id=$3", status, id, tenantID)
		return err
	}
	if status == "closed" {
		_, err := r.db.ExecContext(ctx, "UPDATE tickets SET status=$1, closed_at=NOW(), updated_at=NOW() WHERE id=$2 AND tenant_id=$3", status, id, tenantID)
		return err
	}
	_, err := r.db.ExecContext(ctx, "UPDATE tickets SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3", status, id, tenantID)
	return err
}

func (r *TicketRepository) UpdateAssignee(ctx context.Context, id, tenantID, assignedTo string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE tickets SET assigned_to=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3", assignedTo, id, tenantID)
	return err
}

func (r *TicketRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM tickets WHERE tenant_id=$1`, tenantID)
	return count, err
}
