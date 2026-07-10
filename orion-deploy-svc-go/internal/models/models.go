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

// DeployWindow represents a scheduled deployment window.
type DeployWindow struct {
	ID             string `db:"id" json:"id"`
	TenantID       string `db:"tenant_id" json:"tenant_id"`
	EnvironmentID  string `db:"environment_id" json:"environment_id"`
	Name           string `db:"name" json:"name"`
	CronExpression string `db:"cron_expression" json:"cron_expression"`
	DurationMinutes int   `db:"duration_minutes" json:"duration_minutes"`
	Timezone       string `db:"timezone" json:"timezone"`
	Status         string `db:"status" json:"status"`
	CreatedBy      string `db:"created_by" json:"created_by"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// ProgressiveStage represents a single stage in a multi-stage deployment.
type ProgressiveStage struct {
	ID             string `db:"id" json:"id"`
	TenantID       string `db:"tenant_id" json:"tenant_id"`
	DeploymentID   string `db:"deployment_id" json:"deployment_id"`
	StageName      string `db:"stage_name" json:"stage_name"`
	StageOrder     int    `db:"stage_order" json:"stage_order"`
	TrafficPercent int    `db:"traffic_percent" json:"traffic_percent"`
	InstanceCount  int    `db:"instance_count" json:"instance_count"`
	Status         string `db:"status" json:"status"`
	StartedAt      *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt    *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	ValidationResult sql.NullString `db:"validation_result" json:"validation_result"`
	AutoPromote    bool   `db:"auto_promote" json:"auto_promote"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// EmergencyDeploy represents an emergency deployment request.
type EmergencyDeploy struct {
	ID           string `db:"id" json:"id"`
	TenantID     string `db:"tenant_id" json:"tenant_id"`
	DeploymentID string `db:"deployment_id" json:"deployment_id"`
	Reason       string `db:"reason" json:"reason"`
	RequestedBy  string `db:"requested_by" json:"requested_by"`
	ApprovedBy   sql.NullString `db:"approved_by" json:"approved_by"`
	ApprovedAt   *time.Time `db:"approved_at" json:"approved_at,omitempty"`
	StartedAt    time.Time `db:"started_at" json:"started_at"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Status       string `db:"status" json:"status"`
	PostMortem   sql.NullString `db:"post_mortem" json:"post_mortem"`
	Metadata     sql.NullString `db:"metadata" json:"metadata"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// DeployProgress holds overall deployment progress for a multi-stage deploy.
type DeployProgress struct {
	DeploymentID   string             `json:"deployment_id"`
	TotalStages    int                `json:"total_stages"`
	CurrentStage   *ProgressiveStage  `json:"current_stage"`
	CompletedStages int               `json:"completed_stages"`
	FailedStages   int                `json:"failed_stages"`
	Stages         []ProgressiveStage `json:"stages"`
	OverallPercent int                `json:"overall_percent"`
	Status         string             `json:"status"`
}

// StageCount holds stage counts for a progressive deployment.
type StageCount struct {
	Total     int `db:"total" json:"total"`
	Pending   int `db:"pending" json:"pending"`
	Running   int `db:"running" json:"running"`
	Completed int `db:"completed" json:"completed"`
	Failed    int `db:"failed" json:"failed"`
	Skipped   int `db:"skipped" json:"skipped"`
}

// ReleaseNotes represents generated release notes for a deployment.
type ReleaseNotes struct {
	ID           string `db:"id" json:"id"`
	TenantID     string `db:"tenant_id" json:"tenant_id"`
	DeploymentID string `db:"deployment_id" json:"deployment_id"`
	Version      string `db:"version" json:"version"`
	Environment  string `db:"environment" json:"environment"`
	GeneratedAt  time.Time `db:"generated_at" json:"generated_at"`
	Summary      sql.NullString `db:"summary" json:"summary"`
	Changes      sql.NullString `db:"changes" json:"changes"`
	Metrics      sql.NullString `db:"metrics" json:"metrics"`
	Notes        sql.NullString `db:"notes" json:"notes"`
	Content      sql.NullString `db:"content" json:"content"`
	GeneratedBy  string `db:"generated_by" json:"generated_by"`
	Status       string `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// GitCommitLink represents a git commit linked to a deployment.
type GitCommitLink struct {
	ID           string `db:"id" json:"id"`
	TenantID     string `db:"tenant_id" json:"tenant_id"`
	DeploymentID string `db:"deployment_id" json:"deployment_id"`
	CommitSha    string `db:"commit_sha" json:"commit_sha"`
	CommitMessage sql.NullString `db:"commit_message" json:"commit_message"`
	CommitAuthor  sql.NullString `db:"commit_author" json:"commit_author"`
	CommitEmail   sql.NullString `db:"commit_email" json:"commit_email"`
	CommittedAt   *time.Time `db:"committed_at" json:"committed_at"`
	Branch        sql.NullString `db:"branch" json:"branch"`
	PRNumber      sql.NullString `db:"pr_number" json:"pr_number"`
	PRUrl         sql.NullString `db:"pr_url" json:"pr_url"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}
