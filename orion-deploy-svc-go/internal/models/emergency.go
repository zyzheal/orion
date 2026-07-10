package models

import (
	"database/sql"
	"time"
)

// DeployEmergency represents an emergency deployment request.
type DeployEmergency struct {
	ID          string         `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	DeploymentID string        `db:"deployment_id" json:"deployment_id"`
	Reason      string         `db:"reason" json:"reason"`
	RequestedBy string         `db:"requested_by" json:"requested_by"`
	ApprovedBy  sql.NullString `db:"approved_by" json:"approved_by,omitempty"`
	ApprovedAt  sql.NullTime   `db:"approved_at" json:"approved_at,omitempty"`
	StartedAt   time.Time      `db:"started_at" json:"started_at"`
	CompletedAt sql.NullTime   `db:"completed_at" json:"completed_at,omitempty"`
	Status      string         `db:"status" json:"status"`
	PostMortem  sql.NullString `db:"post_mortem" json:"post_mortem,omitempty"`
	Metadata    sql.NullString `db:"metadata" json:"metadata,omitempty"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   sql.NullTime   `db:"updated_at" json:"updated_at,omitempty"`
}
