package models

import "time"

// Valid relation types
const (
	RelationDuplicate  = "duplicate"
	RelationCausedBy   = "caused-by"
	RelationRelated    = "related"
	RelationBlocks     = "blocks"
	RelationBlockedBy  = "blocked-by"
)

var ValidRelationTypes = []string{
	RelationDuplicate, RelationCausedBy, RelationRelated, RelationBlocks, RelationBlockedBy,
}

// TicketRelation links two tickets
type TicketRelation struct {
	ID              string    `json:"id" db:"id"`
	TicketID        string    `json:"ticket_id" db:"ticket_id"`
	RelatedTicketID string    `json:"related_ticket_id" db:"related_ticket_id"`
	RelationType    string    `json:"relation_type" db:"relation_type"`
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
