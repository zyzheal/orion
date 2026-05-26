package repository

import (
	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type CommentRepository struct {
	db *sqlx.DB
}

func NewCommentRepository(db *sqlx.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) Create(comment *models.TicketComment) error {
	query := `INSERT INTO ticket_comments (id, ticket_id, author, content, is_internal)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(query,
		comment.ID, comment.TicketID, comment.Author, comment.Content, comment.IsInternal,
	)
	return err
}

func (r *CommentRepository) ListByTicket(ticketID string) ([]models.TicketComment, error) {
	var comments []models.TicketComment
	err := r.db.Select(&comments,
		"SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC", ticketID)
	return comments, err
}

func (r *CommentRepository) Delete(id, ticketID string) error {
	_, err := r.db.Exec("DELETE FROM ticket_comments WHERE id = $1 AND ticket_id = $2", id, ticketID)
	return err
}
