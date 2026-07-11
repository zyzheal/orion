package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]any

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value any) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		*j = make(JSONB)
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// Deployment represents a single application deployment record.
// Maps directly to the Node.js deployment type with full tenant isolation.
type Deployment struct {
	ID           string         `json:"id" db:"id"`
	TenantID     string         `json:"tenant_id" db:"tenant_id"`
	AppName      string         `json:"app_name" db:"app_name"`
	Environment  string         `json:"environment" db:"environment"`
	Status       string         `json:"status" db:"status"`
	Version      string         `json:"version" db:"version"`
	Commit       string         `json:"commit" db:"commit"`
	CreatedBy    string         `json:"created_by" db:"created_by"`
	Strategy     string         `json:"strategy" db:"strategy"`
	RollbackTo   string         `json:"rollback_to" db:"rollback_to"`
	Metadata     JSONB          `json:"metadata" db:"metadata"`
	StartedAt    time.Time      `json:"started_at" db:"started_at"`
	CompletedAt  *time.Time     `json:"completed_at,omitempty" db:"completed_at"`
	CreatedAt    time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at" db:"updated_at"`
}

// ReleaseNote represents generated release notes for a deployment.
type ReleaseNote struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	DeploymentID string    `json:"deployment_id" db:"deployment_id"`
	Content      string    `json:"content" db:"content"`
	GeneratedBy  string    `json:"generated_by" db:"generated_by"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// GitLink links a git commit to a deployment for traceability.
type GitLink struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	DeploymentID string    `json:"deployment_id" db:"deployment_id"`
	CommitSHA    string    `json:"commit_sha" db:"commit_sha"`
	RepoURL      string    `json:"repo_url" db:"repo_url"`
	Branch       string    `json:"branch" db:"branch"`
	CreatedBy    string    `json:"created_by" db:"created_by"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// RollbackRecord records each rollback operation for audit purposes.
type RollbackRecord struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenant_id" db:"tenant_id"`
	DeploymentID   string     `json:"deployment_id" db:"deployment_id"`
	RollbackToID   string     `json:"rollback_to_id" db:"rollback_to_id"`
	RollbackFromID string     `json:"rollback_from_id" db:"rollback_from_id"`
	Reason         string     `json:"reason" db:"reason"`
	Status         string     `json:"status" db:"status"`
	CreatedBy      string     `json:"created_by" db:"created_by"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

// DeployMetrics holds deployment metrics for monitoring dashboards.
type DeployMetrics struct {
	TotalDeploys     int            `json:"total_deploys"`
	SuccessCount     int            `json:"success_count"`
	FailureCount     int            `json:"failure_count"`
	PendingCount     int            `json:"pending_count"`
	CancelledCount   int            `json:"cancelled_count"`
	RollbackCount    int            `json:"rollback_count"`
	ByEnvironment    map[string]int `json:"by_environment"`
	ByApp            map[string]int `json:"by_app"`
	AvgDurationSec   float64        `json:"avg_duration_sec"`
	Last7DaysTrend   []TrendPoint   `json:"last_7_days_trend"`
}

// TrendPoint represents a single day in the deployment trend.
type TrendPoint struct {
	Date   string `json:"date"`
	Count  int    `json:"count"`
	Success int   `json:"success"`
	Failure int   `json:"failure"`
}

// AuditEvent records audit trail entries for a deployment.
type AuditEvent struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	DeploymentID string  `json:"deployment_id" db:"deployment_id"`
	Action    string    `json:"action" db:"action"`
	Actor     string    `json:"actor" db:"actor"`
	Detail    JSONB     `json:"detail" db:"detail"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// DeployRequest is the inbound payload for creating a new deployment.
type DeployRequest struct {
	AppName     string            `json:"app_name" binding:"required"`
	Environment string            `json:"environment" binding:"required"`
	Version     string            `json:"version"`
	Commit      string            `json:"commit"`
	Strategy    string            `json:"strategy"`
	Metadata    map[string]any    `json:"metadata"`
	Description string            `json:"description"`
	RollbackTo  string            `json:"rollback_to"`
}

// GenerateReleaseNotesRequest carries generation options.
type GenerateReleaseNotesRequest struct {
	FromCommit string `json:"from_commit"`
	ToCommit   string `json:"to_commit"`
	Template   string `json:"template"`
}

// LinkGitRequest links a git commit to a deployment.
type LinkGitRequest struct {
	CommitSHA string `json:"commit_sha" binding:"required"`
	RepoURL   string `json:"repo_url"`
	Branch    string `json:"branch"`
}

// ListDeployQuery carries filter/pagination parameters.
type ListDeployQuery struct {
	Page        int    `form:"page,default=1"`
	PageSize    int    `form:"page_size,default=20"`
	AppName     string `form:"app_name"`
	Environment string `form:"environment"`
	Status      string `form:"status"`
	OrderBy     string `form:"order_by,default=created_at"`
	Order       string `form:"order,default=DESC"`
}

// UpdateDeployStatusRequest updates a deployment's status.
type UpdateDeployStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// RollbackRequest carries rollback parameters.
type RollbackRequest struct {
	RollbackToID string `json:"rollback_to_id" binding:"required"`
	Reason       string `json:"reason"`
}

// CreateReleaseNoteRequest creates a new release note.
type CreateReleaseNoteRequest struct {
	DeploymentID string `json:"deployment_id" binding:"required"`
	Content      string `json:"content" binding:"required"`
}

// UpdateReleaseNoteRequest updates an existing release note.
type UpdateReleaseNoteRequest struct {
	Content string `json:"content"`
}
