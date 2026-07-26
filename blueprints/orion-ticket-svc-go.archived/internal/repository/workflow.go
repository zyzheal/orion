package repository

import (
	"context"
	"orion-ticket-svc-go/internal/models"

	"orion/go-common/pkg/database"
)

type WorkflowRepository struct {
	db *database.DB
}

func NewWorkflowRepository(db *database.DB) *WorkflowRepository {
	return &WorkflowRepository{db: db}
}

func (r *WorkflowRepository) Create(ctx context.Context, entry *models.WorkflowHistory) error {
	query := `INSERT INTO ticket_workflow_history (id, ticket_id, from_status, to_status, performed_by, reason)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.TicketID, entry.FromStatus, entry.ToStatus, entry.PerformedBy, entry.Reason,
	)
	return err
}

func (r *WorkflowRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error) {
	var history []models.WorkflowHistory
	err := r.db.SelectContext(ctx, &history,
		"SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at ASC", ticketID)
	return history, err
}

func (r *WorkflowRepository) LatestByTicket(ctx context.Context, ticketID string) (*models.WorkflowHistory, error) {
	var h models.WorkflowHistory
	err := r.db.GetContext(ctx, &h,
		"SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1", ticketID)
	if err != nil {
		return nil, err
	}
	return &h, nil
}
