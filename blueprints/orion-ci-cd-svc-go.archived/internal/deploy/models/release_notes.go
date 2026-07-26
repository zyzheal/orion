package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// ReleaseNotes holds generated release notes for a deployment.
type ReleaseNotes struct {
	ID           string         `db:"id" json:"id"`
	DeploymentID string         `db:"deployment_id" json:"deployment_id"`
	TenantID     string         `db:"tenant_id" json:"tenant_id"`
	Version      string         `db:"version" json:"version"`
	Environment  string         `db:"environment" json:"environment"`
	GeneratedAt  time.Time      `db:"generated_at" json:"generated_at"`
	Summary      string         `db:"summary" json:"summary"`
	Changes      sql.NullString `db:"changes" json:"changes,omitempty"`
	Metrics      sql.NullString `db:"metrics" json:"metrics,omitempty"`
	Notes        sql.NullString `db:"notes" json:"notes,omitempty"`
	Content      sql.NullString `db:"content" json:"content,omitempty"`
	GeneratedBy  string         `db:"generated_by" json:"generated_by"`
	Status       string         `db:"status" json:"status"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt    sql.NullTime   `db:"updated_at" json:"updated_at,omitempty"`
}

// ChangeEntry represents a single changelog entry.
type ChangeEntry struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Commit      string `json:"commit"`
	Author      string `json:"author"`
	IssueID     string `json:"issue_id,omitempty"`
	PRNumber    string `json:"pr_number,omitempty"`
	PRURL       string `json:"pr_url,omitempty"`
}

// ReleaseMetrics holds aggregate release note metrics.
type ReleaseMetrics struct {
	TotalCommits   int `json:"total_commits"`
	TotalChanges   int `json:"total_changes"`
	BreakingChanges int `json:"breaking_changes"`
	Features       int `json:"features"`
	Fixes          int `json:"fixes"`
	Improvements   int `json:"improvements"`
}

// MarshalChanges serializes changes to JSON string for storage.
func MarshalChanges(changes []ChangeEntry) (string, error) {
	b, err := json.Marshal(changes)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// UnmarshalChanges deserializes changes from JSON string.
func UnmarshalChanges(raw string) ([]ChangeEntry, error) {
	var changes []ChangeEntry
	if err := json.Unmarshal([]byte(raw), &changes); err != nil {
		return nil, err
	}
	return changes, nil
}
