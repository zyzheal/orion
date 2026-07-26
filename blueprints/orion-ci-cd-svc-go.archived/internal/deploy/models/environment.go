package models

import (
	"database/sql"
	"time"
)

// Environment represents a deployment target environment.
type Environment struct {
	ID            string         `db:"id" json:"id"`
	TenantID      string         `db:"tenant_id" json:"tenant_id"`
	ProjectID     string         `db:"project_id" json:"project_id"`
	Name          string         `db:"name" json:"name"`
	Type          string         `db:"type" json:"type"`
	Cluster       sql.NullString `db:"cluster" json:"cluster,omitempty"`
	Namespace     sql.NullString `db:"namespace" json:"namespace,omitempty"`
	Status        string         `db:"status" json:"status"`
	Locked        bool           `db:"locked" json:"locked"`
	LockedBy      sql.NullString `db:"locked_by" json:"locked_by,omitempty"`
	LockedAt      sql.NullTime   `db:"locked_at" json:"locked_at,omitempty"`
	LockedReason  sql.NullString `db:"locked_reason" json:"locked_reason,omitempty"`
	Config        sql.NullString `db:"config" json:"config,omitempty"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     sql.NullTime   `db:"updated_at" json:"updated_at,omitempty"`
}
