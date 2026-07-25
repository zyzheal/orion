// Package models defines data models for the Extension Point Framework.
//
// The Extension Point Framework provides a service initialization lifecycle
// and event-driven extension point system similar to NeatLogic's
// ModuleInitializedListenerBase + IStartup pattern. It is the Phase 0
// blocking dependency for all NeatLogic-inspired features.
//
// Core concepts:
//   - ExtensionPoint: a pluggable extension point registered in the system
//   - ExtensionHandler: the interface all extension points must implement
//   - StartupTask: tracks initialization of a single extension point
//   - ExtensionEvent: lifecycle event fired on state changes
//
// Tables: extension_points, startup_tasks
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// Extension categories
// ---------------------------------------------------------------------------

const (
	CategoryStartup  = "startup"
	CategoryAPI      = "api"
	CategoryHandler  = "handler"
	CategoryService  = "service"
	CategoryListener = "listener"
)

var ValidCategories = map[string]bool{
	CategoryStartup:  true,
	CategoryAPI:      true,
	CategoryHandler:  true,
	CategoryService:  true,
	CategoryListener: true,
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

const (
	HandlerTypeBuiltin = "builtin"
	HandlerTypePlugin  = "plugin"
)

var ValidHandlerTypes = map[string]bool{
	HandlerTypeBuiltin: true,
	HandlerTypePlugin:  true,
}

// ---------------------------------------------------------------------------
// Extension point statuses
// ---------------------------------------------------------------------------

const (
	StatusRegistered  = "registered"
	StatusInitialized = "initialized"
	StatusActive      = "active"
	StatusDisabled    = "disabled"
	StatusError       = "error"
)

var ValidExtensionStatuses = map[string]bool{
	StatusRegistered:  true,
	StatusInitialized: true,
	StatusActive:      true,
	StatusDisabled:    true,
	StatusError:       true,
}

// ---------------------------------------------------------------------------
// Startup task statuses
// ---------------------------------------------------------------------------

const (
	TaskStatusPending    = "pending"
	TaskStatusRunning    = "running"
	TaskStatusCompleted  = "completed"
	TaskStatusFailed     = "failed"
)

var ValidTaskStatuses = map[string]bool{
	TaskStatusPending:   true,
	TaskStatusRunning:   true,
	TaskStatusCompleted: true,
	TaskStatusFailed:    true,
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

const (
	EventTypeRegister   = "register"
	EventTypeInitialize = "initialize"
	EventTypeShutdown   = "shutdown"
	EventTypeError      = "error"
)

// ---------------------------------------------------------------------------
// JSONB helpers (compatible with existing runner model conventions)
// ---------------------------------------------------------------------------

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ---------------------------------------------------------------------------
// ExtensionPoint — a pluggable extension point in the system
// ---------------------------------------------------------------------------

// ExtensionPoint represents a pluggable extension point in the system.
// It tracks registration, initialization, and lifecycle state.
type ExtensionPoint struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`             // unique name, e.g. "pipeline-engine"
	Category     string    `db:"category" json:"category"`     // startup|api|handler|service|listener
	Description  string    `db:"description" json:"description"`
	HandlerType  string    `db:"handler_type" json:"handler_type"` // builtin|plugin
	Config       JSONB     `db:"config" json:"config"`        // jsonb configuration
	Enabled      bool      `db:"enabled" json:"enabled"`
	Priority     int       `db:"priority" json:"priority"`    // init order (lower = first)
	Status       string    `db:"status" json:"status"`        // registered|initialized|active|disabled|error
	Error        string    `db:"error" json:"error"`
	RegisteredAt time.Time `db:"registered_at" json:"registered_at"`
	InitializedAt *time.Time `db:"initialized_at" json:"initialized_at"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// StartupTask — tracks initialization of a single extension point
// ---------------------------------------------------------------------------

// StartupTask represents a startup initialization task.
// Each ExtensionPoint may have exactly one StartupTask tracking its init.
type StartupTask struct {
	ID          string     `db:"id" json:"id"`
	ExtensionID string     `db:"extension_id" json:"extension_id"`
	Name        string     `db:"name" json:"name"`
	Status      string     `db:"status" json:"status"`       // pending|running|completed|failed
	DurationMs  int64      `db:"duration_ms" json:"duration_ms"`
	Error       string     `db:"error" json:"error"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	FinishedAt  *time.Time `db:"finished_at" json:"finished_at"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// ExtensionEvent — lifecycle event fired when an extension changes state
// ---------------------------------------------------------------------------

// ExtensionEvent is fired when an extension point changes state.
type ExtensionEvent struct {
	Type          string `json:"type"`           // register|initialize|shutdown|error
	ExtensionName string `json:"extension_name"`
	Status        string `json:"status"`
	Timestamp     time.Time `json:"timestamp"`
}

// ---------------------------------------------------------------------------
// Request / Response types for HTTP handler
// ---------------------------------------------------------------------------

// CreateExtensionRequest is the payload for registering a new extension point.
type CreateExtensionRequest struct {
	Name        string            `json:"name" binding:"required"`
	Category    string            `json:"category" binding:"required"`
	Description string            `json:"description"`
	HandlerType string            `json:"handler_type"`
	Config      map[string]string `json:"config"`
	Enabled     *bool             `json:"enabled"`
	Priority    *int              `json:"priority"`
}

// UpdateExtensionRequest is the payload for updating an extension point.
type UpdateExtensionRequest struct {
	Status    *string             `json:"status"`
	Enabled   *bool               `json:"enabled"`
	Priority  *int                `json:"priority"`
	Config    *map[string]string  `json:"config"`
	Description *string           `json:"description"`
}

// ExtensionSummary is the list response for extension points.
type ExtensionSummary struct {
	Name        string            `json:"name"`
	Category    string            `json:"category"`
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Enabled     bool              `json:"enabled"`
	Priority    int               `json:"priority"`
	HandlerType string            `json:"handler_type"`
	Config      map[string]string `json:"config"`
	InitializedAt *time.Time      `json:"initialized_at"`
	CreatedAt   time.Time         `json:"created_at"`
}

// CreateStartupRequest is the payload for running startup tasks.
type CreateStartupRequest struct {
	// ExtensionNames is an optional filter; empty means run all enabled startup extensions.
	ExtensionNames []string `json:"extension_names"`
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value, applying defaults.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capping at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
