package repository

import (
	"time"
)

// CITypeRow is the database row for cmdb_ci_types.
type CITypeRow struct {
	ID          string            `db:"id"`
	TenantID    string            `db:"tenant_id"`
	Name        string            `db:"name"`
	Description *string           `db:"description"`
	Category    string            `db:"category"`
	Icon        *string           `db:"icon"`
	Version     int               `db:"version"`
	Enabled     bool              `db:"enabled"`
	Attributes  map[string]any    `db:"attributes"`
	CreatedAt   time.Time         `db:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at"`
}
