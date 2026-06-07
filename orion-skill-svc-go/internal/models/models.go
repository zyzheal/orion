package models

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB — maps to PostgreSQL jsonb columns
// ---------------------------------------------------------------------------

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
// StringArray — maps to PostgreSQL text[] columns
// ---------------------------------------------------------------------------

type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// ---------------------------------------------------------------------------
// SkillPackage — mirrors skill_packages table
// ---------------------------------------------------------------------------

type SkillPackage struct {
	ID              string         `db:"id"               json:"id"`
	Name            string         `db:"name"             json:"name"`
	Version         string         `db:"version"          json:"version"`
	Description     string         `db:"description"      json:"description"`
	Category        string         `db:"category"         json:"category"`
	Tags            StringArray    `db:"tags"             json:"tags"`
	Author          string         `db:"author"           json:"author"`
	Status          string         `db:"status"           json:"status"`
	Schema          JSONB          `db:"schema"           json:"schema"`
	Capabilities    StringArray    `db:"capabilities"     json:"capabilities,omitempty"`
	Schemas         JSONB          `db:"schemas"          json:"schemas,omitempty"`
	IsVersionLocked bool           `db:"is_version_locked" json:"is_version_locked"`
	InstallCount    int            `db:"install_count"    json:"install_count"`
	Rating          float64        `db:"rating"           json:"rating"`
	RatingCount     int            `db:"rating_count"     json:"rating_count"`
	CreatedAt       time.Time      `db:"created_at"       json:"created_at"`
	UpdatedAt       time.Time      `db:"updated_at"       json:"updated_at"`
}

// ---------------------------------------------------------------------------
// SkillVersion — mirrors skill_versions table
// ---------------------------------------------------------------------------

type SkillVersion struct {
	ID             string         `db:"id"              json:"id"`
	SkillID        string         `db:"skill_id"        json:"skill_id"`
	Version        string         `db:"version"         json:"version"`
	Changelog      sql.NullString `db:"changelog"       json:"changelog,omitempty"`
	Schema         JSONB          `db:"schema"          json:"schema"`
	SchemaSnapshot JSONB          `db:"schema_snapshot" json:"schema_snapshot,omitempty"`
	IsLatest       bool           `db:"is_latest"       json:"is_latest"`
	IsLocked       bool           `db:"is_locked"       json:"is_locked"`
	ReleasedAt     sql.NullTime   `db:"released_at"     json:"released_at,omitempty"`
	CreatedAt      time.Time      `db:"created_at"      json:"created_at"`
}

// ---------------------------------------------------------------------------
// SkillInstance — mirrors skill_instances table
// ---------------------------------------------------------------------------

type SkillInstance struct {
	ID          string         `db:"id"          json:"id"`
	SkillID     string         `db:"skill_id"    json:"skill_id"`
	TenantID    string         `db:"tenant_id"   json:"tenant_id"`
	ProjectID   sql.NullString `db:"project_id"  json:"project_id,omitempty"`
	Name        string         `db:"name"        json:"name"`
	Description sql.NullString `db:"description" json:"description,omitempty"`
	Status      string         `db:"status"      json:"status"`
	Config      JSONB          `db:"config"      json:"config"`
	Bindings    JSONB          `db:"bindings"    json:"bindings"`
	Metadata    JSONB          `db:"metadata"    json:"metadata"`
	IsDefault   bool           `db:"is_default"  json:"is_default"`
	Version     string         `db:"version"     json:"version"`
	CreatedBy   sql.NullString `db:"created_by"  json:"created_by,omitempty"`
	CreatedAt   time.Time      `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at"  json:"updated_at"`
}

// ---------------------------------------------------------------------------
// SkillReview — mirrors skill_reviews table
// ---------------------------------------------------------------------------

type SkillReview struct {
	ID        string    `db:"id"         json:"id"`
	SkillID   string    `db:"skill_id"   json:"skill_id"`
	UserID    string    `db:"user_id"    json:"user_id"`
	Rating    int       `db:"rating"     json:"rating"`
	Comment   sql.NullString `db:"comment" json:"comment,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// SkillExecution — mirrors skill_executions table
// ---------------------------------------------------------------------------

type SkillExecution struct {
	ID           string         `db:"id"            json:"id"`
	TenantID     string         `db:"tenant_id"     json:"tenant_id"`
	SkillID      string         `db:"skill_id"      json:"skill_id"`
	InstanceID   sql.NullString `db:"instance_id"   json:"instance_id,omitempty"`
	Capability   sql.NullString `db:"capability"    json:"capability,omitempty"`
	Status       string         `db:"status"        json:"status"`
	Input        JSONB          `db:"input"         json:"input"`
	Output       JSONB          `db:"output"        json:"output,omitempty"`
	ErrorMessage sql.NullString `db:"error_message" json:"error_message,omitempty"`
	DurationMs   sql.NullInt64  `db:"duration_ms"   json:"duration_ms,omitempty"`
	TriggeredBy  sql.NullString `db:"triggered_by"  json:"triggered_by,omitempty"`
	TriggerMode  string         `db:"trigger_mode"  json:"trigger_mode"`
	Metadata     JSONB          `db:"metadata"      json:"metadata"`
	StartedAt    time.Time      `db:"started_at"    json:"started_at"`
	CompletedAt  sql.NullTime   `db:"completed_at"  json:"completed_at,omitempty"`
	CreatedAt    time.Time      `db:"created_at"    json:"created_at"`
}

// ---------------------------------------------------------------------------
// SkillAuditLog — mirrors skill_audit_logs table
// ---------------------------------------------------------------------------

type SkillAuditLog struct {
	ID        string         `db:"id"         json:"id"`
	SkillID   string         `db:"skill_id"   json:"skill_id"`
	Action    string         `db:"action"     json:"action"`
	ActorID   sql.NullString `db:"actor_id"   json:"actor_id,omitempty"`
	ActorName sql.NullString `db:"actor_name" json:"actor_name,omitempty"`
	OldStatus sql.NullString `db:"old_status" json:"old_status,omitempty"`
	NewStatus sql.NullString `db:"new_status" json:"new_status,omitempty"`
	Reason    sql.NullString `db:"reason"     json:"reason,omitempty"`
	Changes   JSONB          `db:"changes"    json:"changes,omitempty"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / Response DTOs
// ---------------------------------------------------------------------------

type CreateSkillRequest struct {
	Name         string      `json:"name"         binding:"required"`
	Version      string      `json:"version"      binding:"required"`
	Description  string      `json:"description"`
	Category     string      `json:"category"`
	Tags         []string    `json:"tags"`
	Author       string      `json:"author"       binding:"required"`
	Schema       JSONB       `json:"schema"`
	Capabilities []string    `json:"capabilities"`
	Schemas      JSONB       `json:"schemas"`
}

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

type CreateVersionRequest struct {
	Version        string `json:"version"        binding:"required"`
	Changelog      string `json:"changelog"`
	Schema         JSONB  `json:"schema"`
	SchemaSnapshot JSONB  `json:"schema_snapshot"`
	IsLocked       bool   `json:"is_locked"`
}

type CreateReviewRequest struct {
	UserID  string `json:"user_id"  binding:"required"`
	Rating  int    `json:"rating"   binding:"required"`
	Comment string `json:"comment"`
}

type CreateInstanceRequest struct {
	SkillID   string `json:"skill_id"   binding:"required"`
	TenantID  string `json:"tenant_id"  binding:"required"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"       binding:"required"`
	Description string `json:"description"`
	Config    JSONB  `json:"config"`
	Bindings  JSONB  `json:"bindings"`
	Metadata  JSONB  `json:"metadata"`
	IsDefault bool   `json:"is_default"`
	Status    string `json:"status"`
	CreatedBy string `json:"created_by"`
	Version   string `json:"version"`
}

type UpdateInstanceRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Config      JSONB   `json:"config"`
	Bindings    JSONB   `json:"bindings"`
	Metadata    JSONB   `json:"metadata"`
	IsDefault   *bool   `json:"is_default"`
	Status      *string `json:"status"`
	ProjectID   *string `json:"project_id"`
}

type CreateExecutionRequest struct {
	TenantID    string `json:"tenant_id"   binding:"required"`
	SkillID     string `json:"skill_id"    binding:"required"`
	InstanceID  string `json:"instance_id"`
	Capability  string `json:"capability"`
	Input       JSONB  `json:"input"`
	TriggeredBy string `json:"triggered_by"`
	TriggerMode string `json:"trigger_mode"`
	Metadata    JSONB  `json:"metadata"`
}

type UpdateExecutionRequest struct {
	Status       *string `json:"status"`
	Output       JSONB   `json:"output"`
	ErrorMessage *string `json:"error_message"`
	DurationMs   *int    `json:"duration_ms"`
}

// PaginatedRequest is a reusable pagination DTO.
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

// CategoryCount is a row returned by GetCategories.
type CategoryCount struct {
	Category string `db:"category" json:"category"`
	Count    int    `db:"count"    json:"count"`
}

// PaginatedResponse wraps a list result with pagination metadata.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}
