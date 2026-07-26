package models

import (
	"database/sql"
	"time"
)

// DeployWindow represents a scheduled deployment time window.
type DeployWindow struct {
	ID             string         `db:"id" json:"id"`
	TenantID       string         `db:"tenant_id" json:"tenant_id"`
	EnvironmentID  string         `db:"environment_id" json:"environment_id"`
	Name           string         `db:"name" json:"name"`
	CronExpression string         `db:"cron_expression" json:"cron_expression"`
	DurationMinutes int           `db:"duration_minutes" json:"duration_minutes"`
	Timezone       string         `db:"timezone" json:"timezone"`
	Status         string         `db:"status" json:"status"`
	CreatedBy      string         `db:"created_by" json:"created_by"`
	CreatedAt      time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt      sql.NullTime   `db:"updated_at" json:"updated_at,omitempty"`
}
