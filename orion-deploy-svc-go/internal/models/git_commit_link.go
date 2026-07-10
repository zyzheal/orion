package models

import (
	"database/sql"
	"time"
)

// GitCommitLink links a Git commit to a deployment.
type GitCommitLink struct {
	ID           string         `db:"id" json:"id"`
	DeploymentID string         `db:"deployment_id" json:"deployment_id"`
	TenantID     string         `db:"tenant_id" json:"tenant_id"`
	CommitSHA    string         `db:"commit_sha" json:"commit_sha"`
	CommitMsg    sql.NullString `db:"commit_message" json:"commit_message,omitempty"`
	CommitAuthor sql.NullString `db:"commit_author" json:"commit_author,omitempty"`
	CommitEmail  sql.NullString `db:"commit_email" json:"commit_email,omitempty"`
	CommittedAt  sql.NullTime   `db:"committed_at" json:"committed_at,omitempty"`
	Branch       sql.NullString `db:"branch" json:"branch,omitempty"`
	PRNumber     sql.NullString `db:"pr_number" json:"pr_number,omitempty"`
	PRURL        sql.NullString `db:"pr_url" json:"pr_url,omitempty"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt    sql.NullTime   `db:"updated_at" json:"updated_at,omitempty"`
}

// GitCommit represents a parsed Git commit.
type GitCommit struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Author  string `json:"author"`
	Email   string `json:"email"`
	Date    string `json:"date"`
}
