package models

import "time"

// Module represents a runtime module registered in the platform.
type Module struct {
	ID            string            `json:"id" db:"id"`
	Name          string            `json:"name" db:"name"`
	DisplayName   string            `json:"display_name" db:"display_name"`
	Description   string            `json:"description" db:"description"`
	Version       string            `json:"version" db:"version"`
	Enabled       bool              `json:"enabled" db:"enabled"`
	Status        string            `json:"status" db:"status"`
	Dependencies  string            `json:"dependencies" db:"dependencies"`
	StartupOrder  int               `json:"startup_order" db:"startup_order"`
	Core          bool              `json:"core" db:"core"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

// ToggleModuleRequest is the request body for toggling a module's enabled state.
type ToggleModuleRequest struct {
	Enabled bool `json:"enabled" binding:"required"`
}

// ValidationResult describes one dependency validation finding.
type ValidationResult struct {
	ModuleID    string `json:"module_id"`
	Dependency  string `json:"dependency"`
	Resolved    bool   `json:"resolved"`
	Message     string `json:"message"`
}

// ModuleStatusSnapshot is returned by the list endpoint.
type ModuleStatusSnapshot struct {
	Modules []Module `json:"modules"`
	Total   int      `json:"total"`
}
