package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}
func (j JSONB) Value() (driver.Value, error) { if j == nil { return nil, nil }; return json.Marshal(j) }
func (j *JSONB) Scan(src interface{}) error { if src == nil { *j = nil; return nil }; switch v := src.(type) { case []byte: return json.Unmarshal(v, j); case string: return json.Unmarshal([]byte(v), j); default: return fmt.Errorf("cannot scan %T into JSONB", src) } }

// ConfigItem represents a configuration entry.
type ConfigItem struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Key         string    `db:"key" json:"key"`
	Value       string    `db:"value" json:"value"`
	Environment string    `db:"environment" json:"environment"`
	Version     int       `db:"version" json:"version"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ConfigVersion represents a single version snapshot of a configuration.
type ConfigVersion struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ConfigID       string    `db:"config_id" json:"config_id"`
	ConfigKey      string    `db:"config_key" json:"config_key"`
	Environment    string    `db:"environment" json:"environment"`
	Value          string    `db:"value" json:"value"`
	VersionNumber  int       `db:"version_number" json:"version_number"`
	ChangeType     string    `db:"change_type" json:"change_type"`
	ChangedBy      string    `db:"changed_by" json:"changed_by"`
	ChangeReason   string    `db:"change_reason" json:"change_reason"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// ConfigDiff describes a single difference between two configurations.
type ConfigDiff struct {
	Key         string `json:"key"`
	Environment string `json:"environment"`
	OldValue    string `json:"old_value,omitempty"`
	NewValue    string `json:"new_value,omitempty"`
	ChangeType  string `json:"change_type"` // added, removed, modified
}

// DiffReport is the result of comparing two environments.
type DiffReport struct {
	SourceEnv   string       `json:"source_environment"`
	TargetEnv   string       `json:"target_environment"`
	Diffs       []ConfigDiff `json:"diffs"`
	TotalChanges int         `json:"total_changes"`
	Added       int          `json:"added"`
	Removed     int          `json:"removed"`
	Modified    int          `json:"modified"`
	GeneratedAt time.Time    `json:"generated_at"`
}

// VersionDiffReport compares two specific versions of a config.
type VersionDiffReport struct {
	ConfigID    string    `json:"config_id"`
	Key         string    `json:"key"`
	Environment string    `json:"environment"`
	FromVersion int       `json:"from_version"`
	ToVersion   int       `json:"to_version"`
	OldValue    string    `json:"old_value"`
	NewValue    string    `json:"new_value"`
	GeneratedAt time.Time `json:"generated_at"`
}

// RollbackResult describes the outcome of a rollback operation.
type RollbackResult struct {
	Success         bool      `json:"success"`
	NewVersionID    string    `json:"new_version_id"`
	NewVersionNumber int      `json:"new_version_number"`
	RolledBackTo    int       `json:"rolled_back_to"`
	RolledBackBy    string    `json:"rolled_back_by"`
	RolledBackAt    time.Time `json:"rolled_back_at"`
}

// ExportData is a serializable snapshot of a set of configurations.
type ExportData struct {
	TenantID    string       `json:"tenant_id"`
	Environment string       `json:"environment"`
	ExportedAt  time.Time    `json:"exported_at"`
	Count       int          `json:"count"`
	Items       []ConfigItem `json:"items"`
}

// ValidationIssue describes a single config validation problem.
type ValidationIssue struct {
	Key     string `json:"key"`
	Field   string `json:"field"`
	Message string `json:"message"`
	Level   string `json:"level"` // error, warning
}

// ValidationResult is the result of validating a configuration value.
type ValidationResult struct {
	Valid    bool               `json:"valid"`
	Issues   []ValidationIssue  `json:"issues"`
}

// --- Request / Response DTOs ---

type CreateConfigRequest struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value" binding:"required"`
	Env   string `json:"environment"`
}

type SetConfigRequest struct {
	Key         string `json:"key" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Environment string `json:"environment"`
	ChangedBy   string `json:"changed_by"`
	Reason      string `json:"reason"`
}

type RollbackRequest struct {
	TargetVersion int    `json:"target_version" binding:"required"`
	RolledBackBy  string `json:"rolled_back_by"`
}

type ImportRequest struct {
	Items     []SetConfigRequest `json:"items" binding:"required"`
	ChangedBy string             `json:"changed_by"`
}

type DiffRequest struct {
	SourceEnv string `json:"source_environment" binding:"required"`
	TargetEnv string `json:"target_environment" binding:"required"`
}

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
