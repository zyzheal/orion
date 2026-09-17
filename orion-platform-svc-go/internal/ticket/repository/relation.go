package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
)

// relationColumns is the explicit projection every SELECT against
// ticket_relations uses. Never SELECT *: sqlx runs in safe mode, and 571 / 572
// add deleted_at, created_by, updated_by and updated_at to this table, none of
// which models.TicketRelation has a db destination for — a SELECT * fails the
// whole read. created_by is left out even though Create writes it: rows written
// before 572 hold NULL there and NULL does not scan into a string.
const relationColumns = "id, ticket_id, related_id, type, description, confidence, created_at"

type RelationRepository struct {
	db *database.DB
}

func NewRelationRepository(db *database.DB) *RelationRepository {
	return &RelationRepository{db: db}
}

func (r *RelationRepository) Create(ctx context.Context, rel *models.TicketRelation) error {
	// created_at is NOT NULL with no default in 076; no caller sets it.
	if rel.CreatedAt.IsZero() {
		rel.CreatedAt = time.Now().UTC()
	}

	// 076's columns are related_id and type, not related_ticket_id and
	// relation_type; description and confidence come from
	// 696_add_ticket_relation_transfer_columns.sql. tenant_id is deliberately
	// not written: no method here takes a tenant id, so 696 relaxes its NOT
	// NULL for the same reason 686 declined to add one to sla_records.
	//
	// created_by is deliberately not written either. 572 declares it
	// UUID REFERENCES users(id), but CreateRelationRequest.CreatedBy is
	// free-form client input, so any value that is not an existing users.id
	// fails the FK and 500s the whole request. The column is nullable and no
	// SELECT in either ticket module reads it back, so omitting it loses
	// nothing a client-supplied string could have stored. Persisting it needs
	// the authenticated user id, which no method here receives.
	query := `INSERT INTO ticket_relations (id, ticket_id, related_id, type, description, confidence, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		rel.ID, rel.TicketID, rel.RelatedTicketID, rel.RelationType,
		rel.Description, rel.Confidence, rel.CreatedAt,
	)
	return err
}

func (r *RelationRepository) ListByTicket(ctx context.Context, ticketID string) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.SelectContext(ctx, &relations,
		"SELECT "+relationColumns+" FROM ticket_relations WHERE ticket_id = $1 OR related_id = $1 ORDER BY created_at DESC", ticketID)
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
		WHERE ((ticket_id = $1 AND related_id = $2) OR (ticket_id = $2 AND related_id = $1))
		AND type = $3`, ticketID, relatedTicketID, relationType)
	return count > 0, err
}

func (r *RelationRepository) FindSimilar(ctx context.Context, ticketID string, limit int) ([]models.TicketRelation, error) {
	var relations []models.TicketRelation
	err := r.db.SelectContext(ctx, &relations,
		"SELECT "+relationColumns+" FROM ticket_relations WHERE (ticket_id = $1 OR related_id = $1) AND type = 'related' ORDER BY confidence DESC LIMIT $2", ticketID, limit)
	return relations, err
}
