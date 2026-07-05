package models

import (
	"database/sql"
	"time"
)

type Deployment struct {
	ID           string         `db:"id" json:"id"`
	TenantID     string         `db:"tenant_id" json:"tenant_id"`
	Environment  string         `db:"environment" json:"environment"`
	ServiceName  string         `db:"service_name" json:"service_name"`
	Version      string         `db:"version" json:"version"`
	ImageTag     string         `db:"image_tag" json:"image_tag"`
	Status       string         `db:"status" json:"status"`
	Strategy     string         `db:"strategy" json:"strategy"`
	DeployedBy   string         `db:"deployed_by" json:"deployed_by"`
	RollbackTo   *string        `db:"rollback_to" json:"rollback_to,omitempty"`
	ErrorMessage sql.NullString `db:"error_message" json:"error_message,omitempty"`
	StartedAt    *time.Time     `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time     `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   *int64         `db:"duration_ms" json:"duration_ms,omitempty"`
	DeployedAt   *time.Time     `db:"deployed_at" json:"deployed_at,omitempty"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
}

// DeploymentEvent represents an audit log entry for a deployment.
type DeploymentEvent struct {
	ID           string    `db:"id" json:"id"`
	DeploymentID string    `db:"deployment_id" json:"deployment_id"`
	EventType    string    `db:"event_type" json:"event_type"`
	Message      *string   `db:"message" json:"message,omitempty"`
	ActorID      *string   `db:"actor_id" json:"actor_id,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// DeployStats holds aggregate deployment statistics.
type DeployStats struct {
	Total      int     `db:"total" json:"total"`
	Success    int     `db:"success" json:"success"`
	Failed     int     `db:"failed" json:"failed"`
	Deploying  int     `db:"deploying" json:"deploying"`
	AvgDuration float64 `db:"avg_duration" json:"avg_duration"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
