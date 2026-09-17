package models

import "time"

// Valid relation types
const (
	RelationDuplicate = "duplicate"
	RelationCausedBy  = "caused-by"
	RelationRelated   = "related"
	RelationBlocks    = "blocks"
	RelationBlockedBy = "blocked-by"
)

var ValidRelationTypes = []string{
	RelationDuplicate, RelationCausedBy, RelationRelated, RelationBlocks, RelationBlockedBy,
}

// TicketRelation links two tickets. The db tags name 076_create_ticketing_tables.sql's
// columns; the json tags are the API contract and are unchanged.
//
//   RelatedTicketID -> related_id      (076's column is related_id, there is no
//                                      related_ticket_id)
//   RelationType    -> type            (076's column is type VARCHAR(50))
//
// CreatedBy keeps db:"created_by", which 572_add_audit_columns.sql adds as
// UUID REFERENCES users(id). Neither Create nor any SELECT touches the column:
// the request value is free-form client input and would fail the FK to
// users(id), and no SELECT can read it anyway because 076's rows predating 572
// hold NULL and NULL does not scan into a string.
type TicketRelation struct {
	ID              string    `json:"id" db:"id"`
	TicketID        string    `json:"ticket_id" db:"ticket_id"`
	RelatedTicketID string    `json:"related_ticket_id" db:"related_id"`
	RelationType    string    `json:"relation_type" db:"type"`
	CreatedBy       string    `json:"created_by" db:"created_by"`
	Description     string    `json:"description,omitempty" db:"description"`
	Confidence      float64   `json:"confidence,omitempty" db:"confidence"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

// CreateRelationRequest is the input for adding a relation
type CreateRelationRequest struct {
	RelatedTicketID string  `json:"related_ticket_id" binding:"required"`
	RelationType    string  `json:"relation_type" binding:"required"`
	CreatedBy       string  `json:"created_by" binding:"required"`
	Description     string  `json:"description"`
	Confidence      float64 `json:"confidence"`
}

// RootCauseCorrelation represents a root cause analysis result
type RootCauseCorrelation struct {
	TicketIDs    []string `json:"ticket_ids"`
	CommonTags   []string `json:"common_tags"`
	RootCause    string   `json:"root_cause"`
	Confidence   float64  `json:"confidence"`
	RelatedCount int      `json:"related_count"`
}
