package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ticketing/models"

	"orion/go-common/pkg/database"
)

type TicketRepository struct {
	db *database.DB
}

func NewTicketRepository(db *database.DB) *TicketRepository {
	return &TicketRepository{db: db}
}

func (r *TicketRepository) Create(ctx context.Context, ticket *models.Ticket) error {
	query := `INSERT INTO tickets (id, tenant_id, title, description, priority, status, category, reporter_id, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.ExecContext(ctx, query,
		ticket.ID, ticket.TenantID, ticket.Title, ticket.Description,
		ticket.Priority, ticket.Status, ticket.Category, ticket.ReporterID, ticket.Source,
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
	listQ := models.TicketListQuery{
		Status:   q.Status,
		Priority: q.Priority,
		Assignee: q.Assignee,
		Search:   q.Search,
		Limit:    q.Limit,
		Offset:   q.Offset,
	}
	if listQ.Limit <= 0 {
		listQ.Limit = 20
	}
	tickets, err := r.ListTickets(ctx, tenantID, listQ)
	return tickets, len(tickets), err
}

func (r *TicketRepository) ListTickets(ctx context.Context, tenantID string, q models.TicketListQuery) ([]models.Ticket, error) {
	var tickets []models.Ticket

	where := "WHERE tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2

	if q.Status != nil && *q.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *q.Status)
		argIdx++
	}
	if q.Priority != nil && *q.Priority != "" {
		where += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, *q.Priority)
		argIdx++
	}
	if q.Assignee != nil && *q.Assignee != "" {
		where += fmt.Sprintf(" AND assignee_id = $%d", argIdx)
		args = append(args, *q.Assignee)
		argIdx++
	}
	if q.Search != nil && *q.Search != "" {
		where += fmt.Sprintf(" AND (title ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx+1)
		search := "%" + *q.Search + "%"
		args = append(args, search, search)
		argIdx += 2
	}

	limit := 50
	offset := 0
	if q.Limit > 0 {
		limit = q.Limit
	}
	if q.Offset >= 0 {
		offset = q.Offset
	}

	listQuery := where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d OFFSET %d", limit, offset)
	err := r.db.SelectContext(ctx, &tickets, listQuery, args...)
	if err != nil {
		return nil, err
	}

	return tickets, nil
}

func (r *TicketRepository) Update(ctx context.Context, ticket *models.Ticket) error {
	query := `UPDATE tickets SET title=$1, description=$2, priority=$3, status=$4, category=$5, updated_at=NOW() WHERE id=$6 AND tenant_id=$7`
	_, err := r.db.ExecContext(ctx, query,
		ticket.Title, ticket.Description, ticket.Priority,
		ticket.Status, ticket.Category, ticket.ID, ticket.TenantID,
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
	_, err := r.db.ExecContext(ctx, "UPDATE tickets SET assignee_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3", assignedTo, id, tenantID)
	return err
}

func (r *TicketRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM tickets WHERE tenant_id=$1`, tenantID)
	return count, err
}
