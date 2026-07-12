package models

import "time"

// Workspace represents an IaC workspace (Terraform state container).
type Workspace struct {
	ID          string            `json:"id" db:"id"`
	TenantID    string            `json:"tenant_id" db:"tenant_id"`
	Name        string            `json:"name" db:"name"`
	Description string            `json:"description" db:"description"`
	BackendType string            `json:"backend_type" db:"backend_type"` // local, s3, gcs, azurerm
	BackendConfig map[string]string `json:"backend_config,omitempty" db:"backend_config"`
	Variables   map[string]string `json:"variables,omitempty" db:"variables"`
	Environment string            `json:"environment" db:"environment"`
	TerraformVersion string       `json:"terraform_version" db:"terraform_version"`
	Status      string            `json:"status" db:"status"` // active, locked, archived
	CreatedAt   time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

// WorkspaceModule represents a reusable IaC module.
type WorkspaceModule struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Source      string    `json:"source" db:"source"` // git URL or registry path
	Version     string    `json:"version" db:"version"`
	Inputs      map[string]string `json:"inputs,omitempty" db:"inputs"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Plan represents a Terraform plan.
type Plan struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	WorkspaceID   string    `json:"workspace_id" db:"workspace_id"`
	Status        string    `json:"status" db:"status"` // pending, running, completed, failed
	Added         int       `json:"added" db:"added"`
	Changed       int       `json:"changed" db:"changed"`
	Destroyed     int       `json:"destroyed" db:"destroyed"`
	PlanOutput    string    `json:"plan_output,omitempty" db:"plan_output"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	FinishedAt    *time.Time `json:"finished_at,omitempty" db:"finished_at"`
}

// StateVersion represents a snapshot of Terraform state.
type StateVersion struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	WorkspaceID string    `json:"workspace_id" db:"workspace_id"`
	Serial      int       `json:"serial" db:"serial"`
	State       string    `json:"state" db:"state"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// Resource represents a managed IaC resource within a workspace.
type Resource struct {
	ID            string            `json:"id" db:"id"`
	TenantID      string            `json:"tenant_id" db:"tenant_id"`
	WorkspaceID   string            `json:"workspace_id" db:"workspace_id"`
	Type          string            `json:"type" db:"type"`
	Name          string            `json:"name" db:"name"`
	Provider      string            `json:"provider" db:"provider"`
	ModuleAddress string            `json:"module_address" db:"module_address"`
	Status        string            `json:"status" db:"status"`
	Tags          map[string]string `json:"tags,omitempty" db:"tags"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

// --- Request models ---

type CreateWorkspaceRequest struct {
	Name             string            `json:"name" binding:"required"`
	Description      string            `json:"description"`
	BackendType      string            `json:"backend_type" binding:"required"`
	BackendConfig    map[string]string `json:"backend_config"`
	Variables        map[string]string `json:"variables"`
	Environment      string            `json:"environment"`
	TerraformVersion string            `json:"terraform_version"`
}

type UpdateWorkspaceRequest struct {
	Name             *string           `json:"name"`
	Description      *string           `json:"description"`
	BackendConfig    map[string]string `json:"backend_config"`
	Variables        map[string]string `json:"variables"`
	Environment      *string           `json:"environment"`
	TerraformVersion *string           `json:"terraform_version"`
	Status           *string           `json:"status"`
}

type GeneratePlanRequest struct {
	AutoApprove bool              `json:"auto_approve"`
	Variables   map[string]string `json:"variables"`
}

type ApplyPlanRequest struct {
	AutoApprove bool              `json:"auto_approve"`
	Variables   map[string]string `json:"variables"`
}

type ImportResourceRequest struct {
	Type     string `json:"type" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Provider string `json:"provider" binding:"required"`
	ID       string `json:"resource_id" binding:"required"`
}

type CreateModuleRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	Source      string            `json:"source" binding:"required"`
	Version     string            `json:"version"`
	Inputs      map[string]string `json:"inputs"`
}

type StateDiffRequest struct {
	VersionA string `json:"version_a" binding:"required"`
	VersionB string `json:"version_b" binding:"required"`
}

type StateDiffResult struct {
	Added   []Resource `json:"added"`
	Changed []Resource `json:"changed"`
	Removed []Resource `json:"removed"`
}

type PlanSummary struct {
	PlanID     string `json:"plan_id"`
	Status     string `json:"status"`
	Added      int    `json:"added"`
	Changed    int    `json:"changed"`
	Destroyed  int    `json:"destroyed"`
	CreatedAt  string `json:"created_at"`
	FinishedAt string `json:"finished_at"`
}
