package repository

import (
	"context"
	"orion/workflow-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

type RelationRepository struct {
	db *database.DB
}

func NewRelationRepository(db *database.DB) *RelationRepository {
	return &RelationRepository{db: db}
}

func (r *RelationRepository) Create(ctx context.Context, rel *models.TicketRelation) error {
	query := `INSERT INTO ticket_relations (id, ticket_id, related_ticket_id, relation_type, created_by, description, confidence)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		rel.ID, rel.TicketID, rel.RelatedTicketID, rel.RelationType,
		rel.CreatedBy, rel.Description, rel.Confidence,
	)
	return err
}

func (r *RelationRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.SelectContext(ctx, &relations,
		`SELECT * FROM ticket_relations WHERE ticket_id = $1 OR related_ticket_id = $1 ORDER BY created_at DESC`, ticketID)
	return relations, err
}

func (r *RelationRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM ticket_relations WHERE id = $1", id)
	return err
}

func (r *RelationRepository) Exists(ctx context.Context, ticketID, relatedTicketID, relationType string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ticket_relations
		WHERE ((ticket_id = $1 AND related_ticket_id = $2) OR (ticket_id = $2 AND related_ticket_id = $1))
		AND relation_type = $3`, ticketID, relatedTicketID, relationType)
	return count > 0, err
}

func (r *RelationRepository) FindSimilar(ctx context.Context, ticketID string, limit int) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.SelectContext(ctx, &relations,
		`SELECT * FROM ticket_relations
		WHERE (ticket_id = $1 OR related_ticket_id = $1) AND relation_type = 'related'
		ORDER BY confidence DESC LIMIT $2`, ticketID, limit)
	return relations, err
}
