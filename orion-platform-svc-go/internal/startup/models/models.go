package models

import "time"

// ModuleType defines the initialization strategy for a startup module.
type ModuleType string

const (
	ModuleTypeAuto        ModuleType = "auto"
	ModuleTypeLazy        ModuleType = "lazy"
	ModuleTypeConditional ModuleType = "conditional"
)

// ModuleStatus represents the lifecycle state of a startup module.
type ModuleStatus string

const (
	StatusPending     ModuleStatus = "pending"
	StatusInitialized ModuleStatus = "initialized"
	StatusActive      ModuleStatus = "active"
	StatusError       ModuleStatus = "error"
)

// StartupModule is the core domain model persisted in PostgreSQL.
type StartupModule struct {
	ID            string       `db:"id" json:"id"`
	TenantID      string       `db:"tenant_id" json:"tenant_id"`
	Name          string       `db:"name" json:"name"`
	Type          ModuleType   `db:"type" json:"type"`
	Priority      int          `db:"priority" json:"priority"`
	Description   string       `db:"description" json:"description"`
	Config        string       `db:"config" json:"config"` // JSON string
	Status        ModuleStatus `db:"status" json:"status"`
	Error         string       `db:"error" json:"error"`
	DurationMs    int64        `db:"duration_ms" json:"duration_ms"`
	InitializedAt *time.Time   `db:"initialized_at" json:"initialized_at"`
	CreatedAt     time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time    `db:"updated_at" json:"updated_at"`
}

// StartupDependency defines a dependency edge between two startup modules.
type StartupDependency struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	ModuleID  string    `db:"module_id" json:"module_id"`
	DependsOn string    `db:"depends_on" json:"depends_on"` // Name of module it depends on
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateModuleRequest is the input for creating a new startup module.
type CreateModuleRequest struct {
	Name        string     `json:"name" binding:"required"`
	Type        ModuleType `json:"type" binding:"required"`
	Priority    int        `json:"priority"`
	Description string     `json:"description"`
	Config      string     `json:"config"` // JSON string
}

// UpdateModuleRequest is the input for updating an existing startup module.
type UpdateModuleRequest struct {
	Type        *ModuleType  `json:"type"`
	Priority    *int         `json:"priority"`
	Description *string      `json:"description"`
	Config      *string      `json:"config"`
}

// CreateDependencyRequest is the input for adding a dependency.
type CreateDependencyRequest struct {
	DependsOn string `json:"depends_on" binding:"required"`
}
