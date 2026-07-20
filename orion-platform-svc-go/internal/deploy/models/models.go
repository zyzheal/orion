package models

import "time"

// Deployment represents a deployment record.
type Deployment struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	AppName     string     `json:"app_name" db:"app_name"`
	Environment string     `json:"environment" db:"environment"`
	Status      string     `json:"status" db:"status"` // pending, running, succeeded, failed, cancelled, rollback
	Version     string     `json:"version" db:"version"`
	CommitSHA   string     `json:"commit_sha" db:"commit_sha"`
	StartedAt   *time.Time `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// --- Requests ---

// CreateDeploymentRequest is the body for POST /deploy.
type CreateDeploymentRequest struct {
	AppName     string `json:"app_name" binding:"required"`
	Environment string `json:"environment" binding:"required"`
	Version     string `json:"version"`
	CommitSHA   string `json:"commit_sha"`
}

// DeploymentMetrics aggregates deployment counts per environment/status.
type DeploymentMetrics struct {
	Total     int `json:"total"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Running   int `json:"running"`
	Cancelled int `json:"cancelled"`
	Rollback  int `json:"rollback"`
}

// --- Rollback ---

type RollbackRequest struct {
	TargetVersion string `json:"target_version"`
	Reason        string `json:"reason"`
}

type Rollback struct {
	ID           string    `json:"id" db:"id"`
	DeploymentID string    `json:"deployment_id" db:"deployment_id"`
	FromVersion  string    `json:"from_version" db:"from_version"`
	ToVersion    string    `json:"to_version" db:"to_version"`
	Status       string    `json:"status" db:"status"`
	Reason       string    `json:"reason" db:"reason"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// --- Audit ---

type AuditEntry struct {
	ID           int       `json:"id" db:"id"`
	DeploymentID string    `json:"deployment_id" db:"deployment_id"`
	Action       string    `json:"action" db:"action"`
	UserID       string    `json:"user_id" db:"user_id"`
	Details      string    `json:"details" db:"details"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// --- Release notes ---

type ReleaseNote struct {
	ID           string    `json:"id" db:"id"`
	DeploymentID string    `json:"deployment_id" db:"deployment_id"`
	Content      string    `json:"content" db:"content"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type GenerateReleaseNotesRequest struct {
	Description string `json:"description"`
}

// --- Git integration ---

type LinkGitCommitRequest struct {
	CommitSHA string `json:"commit_sha" binding:"required"`
	Branch    string `json:"branch"`
}

type GitChangelogEntry struct {
	CommitSHA string    `json:"commit_sha" db:"commit_sha"`
	Message   string    `json:"message" db:"message"`
	Author    string    `json:"author" db:"author"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
