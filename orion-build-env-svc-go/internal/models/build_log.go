package models

import "time"

// BuildLog represents a build log record
type BuildLog struct {
	ID        string `db:"id" json:"id"`
	TenantID  string `db:"tenant_id" json:"tenant_id"`
	BuildID   string `db:"build_id" json:"build_id"`
	Level     string `db:"level" json:"level"`
	Message   string `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
