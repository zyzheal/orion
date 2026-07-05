package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// ExperimentStatus represents the lifecycle of a chaos experiment.
type ExperimentStatus string

const (
	ExpDraft     ExperimentStatus = "draft"
	ExpActive    ExperimentStatus = "active"
	ExpCompleted ExperimentStatus = "completed"
	ExpArchived  ExperimentStatus = "archived"
)

// ChaosFaultType represents the type of fault to inject.
type ChaosFaultType string

const (
	FaultNetworkLatency  ChaosFaultType = "network_latency"
	FaultServiceDown     ChaosFaultType = "service_down"
	FaultCPUStress       ChaosFaultType = "cpu_stress"
	FaultMemoryStress    ChaosFaultType = "memory_stress"
	FaultDiskFull        ChaosFaultType = "disk_full"
)

// ChaosScope defines the target scope for a chaos experiment.
type ChaosScope struct {
	TenantID   string `json:"tenant_id"`
	ServiceID  string `json:"service_id,omitempty"`
	Environment string `json:"environment"`
}

// Scan implements the sql.Scanner interface for reading JSONB from PostgreSQL.
func (cs *ChaosScope) Scan(src interface{}) error {
	if src == nil {
		*cs = ChaosScope{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return nil
	}
	return json.Unmarshal(data, cs)
}

// Value implements the driver.Valuer interface for writing JSONB to PostgreSQL.
func (cs ChaosScope) Value() (driver.Value, error) {
	return json.Marshal(cs)
}

// ChaosFault represents a single fault injection in a chaos experiment.
type ChaosFault struct {
	Type        ChaosFaultType `json:"type"`
	Target      string         `json:"target"`
	Config      map[string]interface{} `json:"config,omitempty"`
	DurationMs  int            `json:"duration_ms"`
	DelayMs     int            `json:"delay_ms"`
}

// Scan implements sql.Scanner for ChaosFault (stored as JSONB).
func (cf *ChaosFault) Scan(src interface{}) error {
	if src == nil {
		*cf = ChaosFault{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return nil
	}
	return json.Unmarshal(data, cf)
}

// Value implements driver.Valuer for ChaosFault.
func (cf ChaosFault) Value() (driver.Value, error) {
	return json.Marshal(cf)
}

// ChaosExperiment represents a chaos engineering experiment.
type ChaosExperiment struct {
	ID                   string          `db:"id" json:"id"`
	TenantID             string          `db:"tenant_id" json:"tenant_id"`
	Name                 string          `db:"name" json:"name"`
	Description          sql.NullString  `db:"description" json:"description,omitempty"`
	Scope                ChaosScope      `db:"scope" json:"scope"`
	Faults               []ChaosFault    `db:"faults" json:"faults"`
	SteadyStateHypothesis sql.NullString `db:"steady_state_hypothesis" json:"steady_state_hypothesis,omitempty"`
	AutoRollback         bool            `db:"auto_rollback" json:"auto_rollback"`
	Status               ExperimentStatus `db:"status" json:"status"`
	CreatedBy            sql.NullString  `db:"created_by" json:"created_by,omitempty"`
	CreatedAt            time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time       `db:"updated_at" json:"updated_at"`
}

// ChaosRun represents a single execution of a chaos experiment.
type ChaosRun struct {
	ID               string        `db:"id" json:"id"`
	ExperimentID     string        `db:"experiment_id" json:"experiment_id"`
	TenantID         string        `db:"tenant_id" json:"tenant_id"`
	Status           string        `db:"status" json:"status"`
	TriggeredBy      string        `db:"triggered_by" json:"triggered_by"`
	StartedAt        *time.Time    `db:"started_at" json:"started_at,omitempty"`
	CompletedAt      *time.Time    `db:"completed_at" json:"completed_at,omitempty"`
	AffectedServices []string      `db:"affected_services" json:"affected_services,omitempty"`
	ErrorCount       int           `db:"error_count" json:"error_count"`
	Recovered        bool          `db:"recovered" json:"recovered"`
	CreatedAt        time.Time     `db:"created_at" json:"created_at"`
}

// CreateExperimentInput is the input for creating a new chaos experiment.
type CreateExperimentInput struct {
	Name                 string          `json:"name" binding:"required"`
	Description          *string         `json:"description"`
	Scope                ChaosScope      `json:"scope" binding:"required"`
	Faults               []ChaosFault    `json:"faults" binding:"required"`
	SteadyStateHypothesis *string        `json:"steady_state_hypothesis"`
	AutoRollback         *bool           `json:"auto_rollback"`
	CreatedBy            *string         `json:"created_by"`
}

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
