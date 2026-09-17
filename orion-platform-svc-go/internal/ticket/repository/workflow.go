package repository

import (
	"context"
	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type WorkflowRepository struct {
	db *database.DB
}

func NewWorkflowRepository(db *database.DB) *WorkflowRepository {
	return &WorkflowRepository{db: db}
}

func (r *WorkflowRepository) Create(ctx context.Context, entry *models.WorkflowHistory) error {
	// from_status / to_status / performed_by / reason were replaced by the real
	// column names from 076; action, created_at and tenant_id are added because
	// they are NOT NULL with no default and would otherwise reject the row.
	query := `INSERT INTO ticket_workflow_history
		(id, tenant_id, ticket_id, action, from_state, to_state, user_id, comment, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.TenantID, entry.TicketID, entry.Action,
		entry.FromStatus, entry.ToStatus, entry.PerformedBy, entry.Reason, entry.CreatedAt,
	)
	return err
}

func (r *WorkflowRepository) ListByTicket(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistory, error) {
	// Explicit columns, not SELECT *: sqlx runs in safe mode and 571 / 572 add
	// deleted_at, created_by, updated_by and updated_at to this table, none of
	// which WorkflowHistory has a destination field for.
	var history []models.WorkflowHistory
	err := r.db.SelectContext(ctx, &history,
		`SELECT id, tenant_id, ticket_id, action, from_state, to_state, user_id, comment, created_at
		 FROM ticket_workflow_history
		 WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at ASC`, tenantID, ticketID)
	return history, err
}
