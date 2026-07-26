package models

import (
	"database/sql"
	"time"
)

// ProgressiveStage represents one stage in a progressive/staged deployment.
type ProgressiveStage struct {
	ID             string           `db:"id" json:"id"`
	TenantID       string           `db:"tenant_id" json:"tenant_id"`
	DeploymentID   string           `db:"deployment_id" json:"deployment_id"`
	StageName      string           `db:"stage_name" json:"stage_name"`
	StageOrder     int              `db:"stage_order" json:"stage_order"`
	TrafficPercent int              `db:"traffic_percent" json:"traffic_percent"`
	InstanceCount  int              `db:"instance_count" json:"instance_count"`
	Status         string           `db:"status" json:"status"`
	StartedAt      sql.NullTime     `db:"started_at" json:"started_at,omitempty"`
	CompletedAt    sql.NullTime     `db:"completed_at" json:"completed_at,omitempty"`
	ValidationJSON sql.NullString   `db:"validation_result" json:"validation_result,omitempty"`
	AutoPromote    bool             `db:"auto_promote" json:"auto_promote"`
	CreatedAt      time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt      sql.NullTime     `db:"updated_at" json:"updated_at,omitempty"`
}

// StageCount holds counts of progressive stages by status for a deployment.
type StageCount struct {
	Total     int `db:"total" json:"total"`
	Pending   int `db:"pending" json:"pending"`
	Running   int `db:"running" json:"running"`
	Completed int `db:"completed" json:"completed"`
	Failed    int `db:"failed" json:"failed"`
	Skipped   int `db:"skipped" json:"skipped"`
}
