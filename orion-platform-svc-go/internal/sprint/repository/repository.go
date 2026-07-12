package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sprint/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, m *models.Sprint) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sprints (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

// GetBoard returns the sprint board grouped by ticket status.
func (r *Repository) GetBoard(ctx context.Context, tenantID, sprintID string) (*models.SprintBoard, error) {
	// Get sprint details first
	var board models.SprintBoard
	err := r.db.GetContext(ctx, &board,
		`SELECT id, tenant_id, name, status, start_date, end_date FROM sprints WHERE id=$1 AND tenant_id=$2`, sprintID, tenantID)
	if err != nil {
		return nil, err
	}

	// Get tickets in this sprint grouped by status
	var tickets []models.SprintTicket
	err = r.db.SelectContext(ctx, &tickets,
		`SELECT st.id, st.tenant_id, st.sprint_id, st.ticket_id, t.status, st.sort_order, st.created_at
		 FROM sprint_ticket st
		 JOIN tickets t ON t.id = st.ticket_id AND t.tenant_id = st.tenant_id
		 WHERE st.sprint_id=$1 AND st.tenant_id=$2
		 ORDER BY t.status, st.sort_order`, sprintID, tenantID)
	if err != nil {
		return nil, err
	}

	board.TicketsByStatus = make(map[string][]models.SprintTicket)
	for _, t := range tickets {
		status := t.Status
		if status == "" {
			status = "todo"
		}
		board.TicketsByStatus[status] = append(board.TicketsByStatus[status], t)
	}
	return &board, nil
}

// AddTicket adds a ticket to a sprint.
func (r *Repository) AddTicket(ctx context.Context, st *models.SprintTicket) error {
	st.ID = uuid.New().String()
	st.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sprint_ticket (id, tenant_id, sprint_id, ticket_id, sort_order, created_at) VALUES (:id, :tenant_id, :sprint_id, :ticket_id, :sort_order, :created_at)`, st)
	return err
}

// RemoveTicket removes a ticket from a sprint.
func (r *Repository) RemoveTicket(ctx context.Context, tenantID, sprintID, ticketID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM sprint_ticket WHERE tenant_id=$1 AND sprint_id=$2 AND ticket_id=$3`, tenantID, sprintID, ticketID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("ticket not found in sprint")
	}
	return nil
}

// ReorderTickets updates the sort order of tickets in a sprint.
func (r *Repository) ReorderTickets(ctx context.Context, tenantID, sprintID string, orders []models.TicketOrder) error {
	for _, o := range orders {
		_, err := r.db.ExecContext(ctx,
			`UPDATE sprint_ticket SET sort_order=$1 WHERE tenant_id=$2 AND sprint_id=$3 AND ticket_id=$4`,
			o.SortOrder, tenantID, sprintID, o.TicketID)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetBurndownData returns burndown data for a sprint.
func (r *Repository) GetBurndownData(ctx context.Context, tenantID, sprintID string) (*models.BurndownData, error) {
	// Get total ticket count and done count
	var total, done int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM sprint_ticket st WHERE st.sprint_id=$1 AND st.tenant_id=$2`, sprintID, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &done,
		`SELECT COUNT(*) FROM sprint_ticket st JOIN tickets t ON t.id=st.ticket_id
		 WHERE st.sprint_id=$1 AND st.tenant_id=$2 AND t.status IN ('done','closed','completed')`, sprintID, tenantID)
	if err != nil {
		return nil, err
	}

	data := &models.BurndownData{
		SprintID: sprintID,
		Total:    total,
		Done:     done,
		Points:   []models.BurndownPoint{},
	}
	if total == done {
		data.Points = append(data.Points, models.BurndownPoint{Total: total, Done: done, Remaining: 0})
	} else {
		data.Points = append(data.Points, models.BurndownPoint{Total: total, Done: done, Remaining: total - done})
	}
	return data, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Sprint, error) {
	var m models.Sprint
	err := r.db.GetContext(ctx, &m, `SELECT * FROM sprints WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Sprint, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Sprint
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM sprints WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	// Simple update per field
	_, err := r.db.ExecContext(ctx, `UPDATE sprints SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sprints WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
