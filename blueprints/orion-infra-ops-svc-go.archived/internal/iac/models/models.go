package models

import "time"

// IaCWorkspace represents a Terraform/OpenTofu workspace.
type IaCWorkspace struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Provider    string    `db:"provider" json:"provider"`
	Branch      string    `db:"branch" json:"branch"`
	VCSRepo     string    `db:"vcs_repo" json:"vcs_repo,omitempty"`
	Status      string    `db:"status" json:"status"`
	Variables   string    `db:"variables" json:"variables,omitempty"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateWorkspaceRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Provider    string `json:"provider" binding:"required"`
	Branch      string `json:"branch"`
	VCSRepo     string `json:"vcs_repo"`
	Variables   string `json:"variables"`
}

type UpdateWorkspaceRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Provider    *string `json:"provider"`
	Branch      *string `json:"branch"`
	VCSRepo     *string `json:"vcs_repo"`
	Status      *string `json:"status"`
	Variables   *string `json:"variables"`
}

// IaCPlan represents a plan run for a workspace.
type IaCPlan struct {
	ID          string    `db:"id" json:"id"`
	WorkspaceID string    `db:"workspace_id" json:"workspace_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Status      string    `db:"status" json:"status"`
	Output      string    `db:"output" json:"output,omitempty"`
	Changes     int       `db:"changes" json:"changes"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// IaCResource represents a tracked infrastructure resource.
type IaCResource struct {
	ID          string    `db:"id" json:"id"`
	WorkspaceID string    `db:"workspace_id" json:"workspace_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Type        string    `db:"type" json:"type"`
	Name        string    `db:"name" json:"name"`
	Provider    string    `db:"provider" json:"provider"`
	Attributes  string    `db:"attributes" json:"attributes,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// IaCModule represents a reusable module.
type IaCModule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Provider    string    `db:"provider" json:"provider"`
	Source      string    `db:"source" json:"source"`
	Version     string    `db:"version" json:"version"`
	Variables   string    `db:"variables" json:"variables,omitempty"`
	Outputs     string    `db:"outputs" json:"outputs,omitempty"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateModuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Provider    string `json:"provider" binding:"required"`
	Source      string `json:"source" binding:"required"`
	Version     string `json:"version"`
	Variables   string `json:"variables"`
	Outputs     string `json:"outputs"`
}

// IaCStateVersion represents a version of the state file.
type IaCStateVersion struct {
	ID          string    `db:"id" json:"id"`
	WorkspaceID string    `db:"workspace_id" json:"workspace_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Version     int       `db:"version" json:"version"`
	State       string    `db:"state" json:"state,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// IaCStateDiff represents a diff between two state versions.
type IaCStateDiff struct {
	VersionA  int      `json:"version_a"`
	VersionB  int      `json:"version_b"`
	Additions []string `json:"additions"`
	Deletions []string `json:"deletions"`
	Modifications []string `json:"modifications"`
}