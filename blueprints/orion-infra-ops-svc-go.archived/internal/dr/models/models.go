package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ─── JSONB helper ─────────────────────────────────────────────────────────────

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

// JSONArray is a JSON array stored in PostgreSQL as JSONB.
type JSONArray []interface{}

func (j JSONArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONArray) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// StringArray is a JSON string array stored in PostgreSQL as JSONB.
type StringArray []string

func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *StringArray) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// ─── DR Plan ─────────────────────────────────────────────────────────────────

type DRPlan struct {
	ID              string     `db:"id" json:"id"`
	TenantID        string     `db:"tenant_id" json:"tenant_id"`
	Name            string     `db:"name" json:"name"`
	PlanType        string     `db:"plan_type" json:"plan_type"`
	RPO             int        `db:"rpo" json:"rpo"`
	RTO             int        `db:"rto" json:"rto"`
	Status          string     `db:"status" json:"status"`
	Priority        string     `db:"priority" json:"priority"`
	FailoverStrategy string   `db:"failover_strategy" json:"failover_strategy"`
	BackupRegions   StringArray `db:"backup_regions" json:"backup_regions"`
	Services        JSONArray  `db:"services" json:"services"`
	LastTested      *time.Time `db:"last_tested" json:"last_tested,omitempty"`
	Config          JSONB      `db:"config" json:"config,omitempty"`
	CreatedBy       string     `db:"created_by" json:"created_by"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateDRPlanRequest struct {
	Name             string   `json:"name" binding:"required"`
	PlanType         string   `json:"plan_type" binding:"required"`
	RPO              int      `json:"rpo" binding:"required,gt=0"`
	RTO              int      `json:"rto" binding:"required,gt=0"`
	Priority         string   `json:"priority"`
	FailoverStrategy string   `json:"failover_strategy"`
	BackupRegions    []string `json:"backup_regions"`
	Services         []interface{} `json:"services"`
	CreatedBy        string   `json:"created_by"`
}

type UpdateDRPlanRequest struct {
	Name             *string       `json:"name"`
	PlanType         *string       `json:"plan_type"`
	RPO              *int          `json:"rpo"`
	RTO              *int          `json:"rto"`
	Status           *string       `json:"status"`
	Priority         *string       `json:"priority"`
	FailoverStrategy *string       `json:"failover_strategy"`
	BackupRegions    []string      `json:"backup_regions"`
	Services         []interface{} `json:"services"`
	Config           JSONB         `json:"config"`
}

// ─── Failover Test ───────────────────────────────────────────────────────────

type FailoverTest struct {
	ID               string     `db:"id" json:"id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	PlanID           string     `db:"plan_id" json:"plan_id"`
	TestName         string     `db:"test_name" json:"test_name"`
	TestType         string     `db:"test_type" json:"test_type"`
	StartedAt        time.Time  `db:"started_at" json:"started_at"`
	CompletedAt      *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	ActualRTO        *int       `db:"actual_rto" json:"actual_rto,omitempty"`
	ActualRPO        *int       `db:"actual_rpo" json:"actual_rpo,omitempty"`
	Result           string     `db:"result" json:"result"`
	AffectedServices StringArray `db:"affected_services" json:"affected_services"`
	Findings         *string    `db:"findings" json:"findings,omitempty"`
	CreatedBy        string     `db:"created_by" json:"created_by"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}

type TriggerFailoverRequest struct {
	TriggeredBy string `json:"triggered_by"`
}

type TestFailoverRequest struct {
	TestName  string `json:"test_name"`
	TestedBy  string `json:"tested_by"`
}

type CompleteFailoverTestRequest struct {
	ActualRTO int     `json:"actual_rto" binding:"gte=0"`
	ActualRPO int     `json:"actual_rpo" binding:"gte=0"`
	Result    string  `json:"result" binding:"required,oneof=passed failed partial"`
	Findings  *string `json:"findings"`
}

// ─── Backup Config ───────────────────────────────────────────────────────────

type BackupConfig struct {
	ID              string     `db:"id" json:"id"`
	TenantID        string     `db:"tenant_id" json:"tenant_id"`
	SourceType      string     `db:"source_type" json:"source_type"`
	SourceID        string     `db:"source_id" json:"source_id"`
	BackupSchedule  string     `db:"backup_schedule" json:"backup_schedule"`
	RetentionDays   int        `db:"retention_days" json:"retention_days"`
	StorageLocation string     `db:"storage_location" json:"storage_location"`
	Encryption      bool       `db:"encryption" json:"encryption"`
	Compression     string     `db:"compression" json:"compression"`
	LastBackupAt    *time.Time `db:"last_backup_at" json:"last_backup_at,omitempty"`
	LastBackupSize  int64      `db:"last_backup_size" json:"last_backup_size"`
	Enabled         bool       `db:"enabled" json:"enabled"`
	CreatedBy       string     `db:"created_by" json:"created_by"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateBackupConfigRequest struct {
	SourceType      string `json:"source_type" binding:"required"`
	SourceID        string `json:"source_id" binding:"required"`
	BackupSchedule  string `json:"backup_schedule"`
	RetentionDays   *int   `json:"retention_days"`
	StorageLocation string `json:"storage_location" binding:"required"`
	Encryption      *bool  `json:"encryption"`
	Compression     string `json:"compression"`
	CreatedBy       string `json:"created_by"`
}

type UpdateBackupConfigRequest struct {
	BackupSchedule  *string `json:"backup_schedule"`
	RetentionDays   *int    `json:"retention_days"`
	StorageLocation *string `json:"storage_location"`
	Encryption      *bool   `json:"encryption"`
	Compression     *string `json:"compression"`
	Enabled         *bool   `json:"enabled"`
}

// ─── DR Policy ───────────────────────────────────────────────────────────────

type DRPolicy struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Name        string     `db:"name" json:"name"`
	Description *string    `db:"description" json:"description,omitempty"`
	Services    JSONArray  `db:"services" json:"services"`
	Strategy    string     `db:"strategy" json:"strategy"`
	RPO         string     `db:"rpo" json:"rpo"`
	RTO         string     `db:"rto" json:"rto"`
	Priority    int        `db:"priority" json:"priority"`
	Status      string     `db:"status" json:"status"`
	ProjectID   *string    `db:"project_id" json:"project_id,omitempty"`
	Config      JSONB      `db:"config" json:"config,omitempty"`
	CreatedBy   string     `db:"created_by" json:"created_by"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

type CreatePolicyRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Services    []interface{}          `json:"services" binding:"required"`
	Strategy    string                 `json:"strategy" binding:"required,oneof=active-active active-passive warm-standby cold-standby"`
	RPO         string                 `json:"rpo" binding:"required"`
	RTO         string                 `json:"rto" binding:"required"`
	Priority    int                    `json:"priority"`
	Config      map[string]interface{} `json:"config"`
	CreatedBy   string                 `json:"created_by"`
}

type UpdatePolicyRequest struct {
	Name        *string                `json:"name"`
	Description *string                `json:"description"`
	Services    []interface{}          `json:"services"`
	Strategy    *string                `json:"strategy"`
	RPO         *string                `json:"rpo"`
	RTO         *string                `json:"rto"`
	Priority    *int                   `json:"priority"`
	Status      *string                `json:"status"`
	Config      map[string]interface{} `json:"config"`
}

// ─── Drill ───────────────────────────────────────────────────────────────────

type ScheduleDrillRequest struct {
	PlanID        *string `json:"plan_id"`
	ComponentType string  `json:"component_type" binding:"required"`
	TestType      string  `json:"test_type"`
	ScheduledAt   string  `json:"scheduled_at"`
	CreatedBy     string  `json:"created_by"`
}

// ─── Response / Result types ─────────────────────────────────────────────────

type FailoverTriggerResult struct {
	ID        string    `json:"id"`
	PlanID    string    `json:"plan_id"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	Message   string    `json:"message"`
}

type RTOResult struct {
	PlanID      string     `json:"plan_id"`
	PlanName    string     `json:"plan_name"`
	TargetRTO   int        `json:"target_rto"`
	LastTestRTO *int       `json:"last_test_rto"`
	LastTested  *time.Time `json:"last_tested"`
	Compliance  string     `json:"compliance"`
}

type RPOResult struct {
	PlanID      string     `json:"plan_id"`
	PlanName    string     `json:"plan_name"`
	TargetRPO   int        `json:"target_rpo"`
	LastTestRPO *int       `json:"last_test_rpo"`
	LastTested  *time.Time `json:"last_tested"`
	Compliance  string     `json:"compliance"`
}

type FailoverCostEstimate struct {
	Strategy     string `json:"strategy"`
	ServiceCount int    `json:"service_count"`
	CostEstimate int    `json:"cost_estimate"`
}

// ─── Pagination ──────────────────────────────────────────────────────────────

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
