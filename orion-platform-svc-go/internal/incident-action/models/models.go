package models

import (
	"errors"
	"time"
)

// IncidentAction is one entry of the incident remediation playbook registry
// (table incident_actions, migration 377).
type IncidentAction struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name" binding:"required"`
	Value     string    `json:"value" db:"value" binding:"required"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// ErrUnknownUpdateField marks an Update request that names a column callers may
// not write. Handlers map it to HTTP 400 rather than 500.
var ErrUnknownUpdateField = errors.New("unknown update field")

// UpdateableColumns is the exhaustive, ordered set of incident_actions columns
// a caller may write through Update. It is ordered so that the generated SET
// clause (and therefore the positional argument numbering) is deterministic.
// Excluded on purpose: id (repository-supplied), tenant_id (overwriting it would
// move a row to another tenant), created_at, and updated_at (server timestamps).
var UpdateableColumns = []string{"name", "value", "enabled"}
