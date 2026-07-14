package models

import "time"

// PipelineVersion represents a versioned snapshot of a pipeline definition.
type PipelineVersion struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	PipelineID     string     `db:"pipeline_id" json:"pipelineId"`
	Version        string     `db:"version" json:"version"`
	YAMLDefinition string     `db:"yaml_definition" json:"yamlDefinition"`
	Description    *string    `db:"description" json:"description"`
	Tags           string     `db:"tags" json:"tags"`
	IsBaseline     bool       `db:"is_baseline" json:"isBaseline"`
	CreatedBy      string     `db:"created_by" json:"createdBy"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
}

// CreateVersionRequest is the request body for creating a pipeline version.
type CreateVersionRequest struct {
	Version        string  `json:"version" binding:"required"`
	YAMLDefinition string  `json:"yamlDefinition" binding:"required"`
	Description    *string `json:"description"`
}

// DiffRequest is the request for computing a diff between two versions.
type DiffRequest struct {
	OtherVersionID string `json:"otherVersionId" binding:"required"`
}

// AddTagRequest is the request body for adding a tag to a version.
type AddTagRequest struct {
	Tag string `json:"tag" binding:"required"`
}

// SetBaselineRequest is the request body for setting/unsetting baseline.
type SetBaselineRequest struct {
	Set bool `json:"set"`
}

// DiffResult is the result of a version-to-version diff.
type DiffResult struct {
	FromVersion string   `json:"fromVersion"`
	ToVersion   string   `json:"toVersion"`
	Summary     DiffSummary `json:"summary"`
	Changes     []Change `json:"changes"`
}

// DiffSummary holds aggregate counts of the diff.
type DiffSummary struct {
	Added   int `json:"added"`
	Removed int `json:"removed"`
	Modified int `json:"modified"`
}

// Change represents a single field-level change between versions.
type Change struct {
	Field      string  `json:"field"`
	OldValue   *string `json:"oldValue"`
	NewValue   *string `json:"newValue"`
	ChangeType string  `json:"changeType"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
