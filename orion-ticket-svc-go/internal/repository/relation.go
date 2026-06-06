package repository

import (
	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type RelationRepository struct {
	db *sqlx.DB
}

func NewRelationRepository(db *sqlx.DB) *RelationRepository {
	return &RelationRepository{db: db}
}

func (r *RelationRepository) Create(rel *models.TicketRelation) error {
	query := `INSERT INTO ticket_relations (id, ticket_id, related_ticket_id, relation_type, created_by, description, confidence)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query,
		rel.ID, rel.TicketID, rel.RelatedTicketID, rel.RelationType,
		rel.CreatedBy, rel.Description, rel.Confidence,
	)
	return err
}

func (r *RelationRepository) ListByTicket(ticketID string) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.Select(&relations,
		`SELECT * FROM ticket_relations WHERE ticket_id = $1 OR related_ticket_id = $1 ORDER BY created_at DESC`, ticketID)
	return relations, err
}

func (r *RelationRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM ticket_relations WHERE id = $1", id)
	return err
}

func (r *RelationRepository) Exists(ticketID, relatedTicketID, relationType string) (bool, error) {
	var count int
	err := r.db.Get(&count,
		`SELECT COUNT(*) FROM ticket_relations
		WHERE ((ticket_id = $1 AND related_ticket_id = $2) OR (ticket_id = $2 AND related_ticket_id = $1))
		AND relation_type = $3`, ticketID, relatedTicketID, relationType)
	return count > 0, err
}

func (r *RelationRepository) FindSimilar(ticketID string, limit int) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.Select(&relations,
		`SELECT * FROM ticket_relations
		WHERE (ticket_id = $1 OR related_ticket_id = $1) AND relation_type = 'related'
		ORDER BY confidence DESC LIMIT $2`, ticketID, limit)
	return relations, err
}
