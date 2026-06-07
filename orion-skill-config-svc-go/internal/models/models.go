package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a map type that implements sql.Scanner and driver.Valuer for PostgreSQL JSONB columns.
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

// SkillPackage represents a skill definition in the marketplace.
type SkillPackage struct {
	ID              string    `db:"id" json:"id"`
	Name            string    `db:"name" json:"name"`
	Version         string    `db:"version" json:"version"`
	Description     string    `db:"description" json:"description"`
	Category        string    `db:"category" json:"category"`
	Tags            []string  `db:"tags" json:"tags"`
	Author          string    `db:"author" json:"author"`
	Status          string    `db:"status" json:"status"`
	Schema          JSONB     `db:"schema" json:"schema"`
	Capabilities    *string   `db:"capabilities" json:"capabilities,omitempty"`
	Schemas         *string   `db:"schemas" json:"schemas,omitempty"`
	IsVersionLocked bool      `db:"is_version_locked" json:"is_version_locked"`
	InstallCount    int       `db:"install_count" json:"install_count"`
	Rating          float64   `db:"rating" json:"rating"`
	RatingCount     int       `db:"rating_count" json:"rating_count"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// SkillVersion represents a versioned snapshot of a skill package.
type SkillVersion struct {
	ID             string     `db:"id" json:"id"`
	SkillID        string     `db:"skill_id" json:"skill_id"`
	Version        string     `db:"version" json:"version"`
	Changelog      *string    `db:"changelog" json:"changelog,omitempty"`
	Schema         JSONB      `db:"schema" json:"schema"`
	SchemaSnapshot *string    `db:"schema_snapshot" json:"schema_snapshot,omitempty"`
	IsLatest       bool       `db:"is_latest" json:"is_latest"`
	IsLocked       bool       `db:"is_locked" json:"is_locked"`
	ReleasedAt     *time.Time `db:"released_at" json:"released_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
}

// SkillInstance represents a tenant-specific instance of a skill package.
type SkillInstance struct {
	ID          string    `db:"id" json:"id"`
	SkillID     string    `db:"skill_id" json:"skill_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ProjectID   *string   `db:"project_id" json:"project_id,omitempty"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description,omitempty"`
	Status      string    `db:"status" json:"status"`
	Config      JSONB     `db:"config" json:"config"`
	Bindings    JSONB     `db:"bindings" json:"bindings"`
	Metadata    JSONB     `db:"metadata" json:"metadata"`
	IsDefault   bool      `db:"is_default" json:"is_default"`
	Version     string    `db:"version" json:"version"`
	CreatedBy   *string   `db:"created_by" json:"created_by,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// SkillReview represents a user rating for a skill.
type SkillReview struct {
	ID        string    `db:"id" json:"id"`
	SkillID   string    `db:"skill_id" json:"skill_id"`
	UserID    string    `db:"user_id" json:"user_id"`
	Rating    int       `db:"rating" json:"rating"`
	Comment   *string   `db:"comment" json:"comment,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// SkillExecution represents a single execution of a skill.
type SkillExecution struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenant_id"`
	SkillID      string     `db:"skill_id" json:"skill_id"`
	InstanceID   *string    `db:"instance_id" json:"instance_id,omitempty"`
	Capability   *string    `db:"capability" json:"capability,omitempty"`
	Status       string     `db:"status" json:"status"`
	Input        JSONB      `db:"input" json:"input"`
	Output       *string    `db:"output" json:"output,omitempty"`
	ErrorMessage *string    `db:"error_message" json:"error_message,omitempty"`
	DurationMs   *int       `db:"duration_ms" json:"duration_ms,omitempty"`
	TriggeredBy  *string    `db:"triggered_by" json:"triggered_by,omitempty"`
	TriggerMode  string     `db:"trigger_mode" json:"trigger_mode"`
	Metadata     JSONB      `db:"metadata" json:"metadata"`
	StartedAt    time.Time  `db:"started_at" json:"started_at"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// SkillAuditLog represents an audit trail entry for skill lifecycle changes.
type SkillAuditLog struct {
	ID        string    `db:"id" json:"id"`
	SkillID   string    `db:"skill_id" json:"skill_id"`
	Action    string    `db:"action" json:"action"`
	ActorID   *string   `db:"actor_id" json:"actor_id,omitempty"`
	ActorName *string   `db:"actor_name" json:"actor_name,omitempty"`
	OldStatus *string   `db:"old_status" json:"old_status,omitempty"`
	NewStatus *string   `db:"new_status" json:"new_status,omitempty"`
	Reason    *string   `db:"reason" json:"reason,omitempty"`
	Changes   *string   `db:"changes" json:"changes,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ==================== Request Types ====================

// CreateSkillRequest is the input for creating a skill package.
type CreateSkillRequest struct {
	Name         string   `json:"name" binding:"required"`
	Version      string   `json:"version" binding:"required"`
	Description  string   `json:"description" binding:"required"`
	Category     string   `json:"category"`
	Tags         []string `json:"tags"`
	Author       string   `json:"author" binding:"required"`
	Schema       JSONB    `json:"schema"`
	Capabilities []string `json:"capabilities"`
	Schemas      JSONB    `json:"schemas"`
}

// UpdateSkillRequest is the input for updating a skill package.
type UpdateSkillRequest struct {
	Name            *string  `json:"name"`
	Description     *string  `json:"description"`
	Category        *string  `json:"category"`
	Tags            []string `json:"tags"`
	Status          *string  `json:"status"`
	Schema          JSONB    `json:"schema"`
	Capabilities    []string `json:"capabilities"`
	Schemas         JSONB    `json:"schemas"`
	IsVersionLocked *bool    `json:"is_version_locked"`
}

// CreateVersionRequest is the input for creating a skill version.
type CreateVersionRequest struct {
	Version        string `json:"version" binding:"required"`
	Changelog      string `json:"changelog"`
	Schema         JSONB  `json:"schema"`
	SchemaSnapshot JSONB  `json:"schema_snapshot"`
	IsLocked       bool   `json:"is_locked"`
}

// CreateReviewRequest is the input for adding a review.
type CreateReviewRequest struct {
	UserID  string  `json:"user_id" binding:"required"`
	Rating  int     `json:"rating" binding:"required"`
	Comment *string `json:"comment"`
}

// CreateInstanceRequest is the input for creating a skill instance.
type CreateInstanceRequest struct {
	SkillID   string `json:"skill_id" binding:"required"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name" binding:"required"`
	Config    JSONB  `json:"config"`
	IsDefault bool   `json:"is_default"`
}

// UpdateInstanceRequest is the input for updating a skill instance.
type UpdateInstanceRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Config      JSONB   `json:"config"`
	IsDefault   *bool   `json:"is_default"`
	ProjectID   *string `json:"project_id"`
	Status      *string `json:"status"`
}

// CreateExecutionRequest is the input for creating an execution record.
type CreateExecutionRequest struct {
	InstanceID  *string `json:"instance_id"`
	Capability  *string `json:"capability"`
	Input       JSONB   `json:"input"`
	TriggeredBy *string `json:"triggered_by"`
	TriggerMode *string `json:"trigger_mode"`
	Metadata    JSONB   `json:"metadata"`
}

// UpdateExecutionRequest is the input for updating an execution record.
type UpdateExecutionRequest struct {
	Status       *string    `json:"status"`
	Output       *string    `json:"output"`
	ErrorMessage *string    `json:"error_message"`
	DurationMs   *int       `json:"duration_ms"`
	CompletedAt  *time.Time `json:"completed_at"`
}

// CreateAuditLogRequest is the input for creating an audit log entry.
type CreateAuditLogRequest struct {
	Action    string  `json:"action" binding:"required"`
	ActorID   *string `json:"actor_id"`
	ActorName *string `json:"actor_name"`
	OldStatus *string `json:"old_status"`
	NewStatus *string `json:"new_status"`
	Reason    *string `json:"reason"`
	Changes   *string `json:"changes"`
}

// ==================== Response Types ====================

// PaginatedResponse wraps a paginated result.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// CategoryCount represents a category with its skill count.
type CategoryCount struct {
	Category string `db:"category" json:"category"`
	Count    int    `db:"count" json:"count"`
}

// ==================== Pagination ====================

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ==================== Backward Compatibility ====================

// SkillConfig is kept for backward compatibility with existing tests.
type SkillConfig struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	SkillID      string    `db:"skill_id" json:"skill_id"`
	ConfigKey    string    `db:"config_key" json:"config_key"`
	ConfigValue  string    `db:"config_value" json:"config_value"`
	Environment  string    `db:"environment" json:"environment"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// CreateSkillConfigRequest is kept for backward compatibility.
type CreateSkillConfigRequest struct {
	Name         string `json:"name" binding:"required"`
	SkillID      string `json:"skill_id" binding:"required"`
	ConfigKey    string `json:"config_key" binding:"required"`
	ConfigValue  string `json:"config_value" binding:"required"`
}
