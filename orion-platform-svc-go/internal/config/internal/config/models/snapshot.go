package models

import "time"

// ConfigSnapshot represents a point-in-time snapshot of a configuration.
type ConfigSnapshot struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ConfigID    string    `db:"config_id" json:"config_id"`
	VersionID   string    `db:"version_id" json:"version_id"`
	Data        JSONB     `db:"data" json:"data"`
	Description string    `db:"description" json:"description"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type CreateSnapshotRequest struct {
	Description string `json:"description" binding:"required"`
	CreatedBy   string `json:"created_by"`
}

type RestoreSnapshotRequest struct {
	RestoredBy string `json:"restored_by"`
}